import {
  appointmentServiceAllocations,
  appointmentServices,
  appointmentStatusHistory,
  appointments,
  type Database,
} from '@salon/database';
import { ConflictError, handleExclusionViolation, ResourceNotFoundError } from '@salon/shared';
import { and, count, desc, eq, gte, lte, sql } from 'drizzle-orm';
import type {
  AppointmentFilters,
  CancelAppointmentData,
  IAppointmentRepository,
  OccupiedAllocationInterval,
  RescheduleAppointmentData,
  ResolvedAppointmentBookingData,
  TransitionAppointmentStatusData,
} from '../../application/ports/appointment-repository.port.js';
import {
  type AppointmentEntity,
  type AppointmentSegmentEntity,
  type AppointmentStatus,
  BLOCKING_STATUSES,
  type BookingChannel,
  canTransitionStatus,
} from '../../domain/entities/appointment.entity.js';
import { computeTimedSegments } from '../../domain/services/segment-timing.js';

/**
 * Drizzle implementation of `IAppointmentRepository`.
 *
 * Persists appointments, segments, and GiST exclusion allocations atomically.
 * Domain math and snapshot resolution are performed outside the repository
 * at the application/domain layer.
 *
 * The GiST EXCLUDE constraint `no_staff_time_overlap` (migration 0008) is the
 * final arbiter for double-booking — SQLSTATE 23P01 is mapped to ConflictError.
 */
export class AppointmentRepository implements IAppointmentRepository {
  constructor(private readonly db: Database) {}

  async reserve(data: ResolvedAppointmentBookingData): Promise<AppointmentEntity> {
    if (!data.segments || data.segments.length === 0) {
      throw new ResourceNotFoundError('Appointment must have at least one service segment.');
    }

    try {
      // ── Fast Atomic Write Transaction (INSIDE TX, <2ms duration) ─────────
      return await this.db.transaction(async (tx) => {
        // 1. Insert parent appointment
        const [appt] = await tx
          .insert(appointments)
          .values({
            businessId: data.businessId,
            branchId: data.branchId,
            businessCustomerId: data.businessCustomerId,
            status: data.initialStatus,
            bookingChannel: data.bookingChannel,
            scheduledStartAt: data.scheduledStartAt,
            scheduledEndAt: data.scheduledEndAt,
            createdByBusinessMemberId: data.createdByBusinessMemberId ?? null,
            createdByUserId: data.createdByUserId ?? null,
          })
          .returning();

        if (!appt) {
          throw new Error('Failed to insert appointment record.');
        }

        // 2. Batch insert appointment services
        const insertedServices = await tx
          .insert(appointmentServices)
          .values(
            data.segments.map((seg) => ({
              businessId: data.businessId,
              appointmentId: appt.id,
              serviceId: seg.serviceId,
              staffMemberId: seg.staffMemberId,
              serviceName: seg.serviceName,
              staffName: seg.staffDisplayName,
              unitPrice: seg.unitPrice,
              durationMinutes: seg.durationMinutes,
              bufferBeforeMinutes: seg.bufferBeforeMinutes,
              bufferAfterMinutes: seg.bufferAfterMinutes,
              startsAt: seg.startsAt,
              endsAt: seg.endsAt,
              sequence: seg.sequence,
              notes: seg.notes ?? null,
            })),
          )
          .returning();

        // 3. Batch insert appointment service allocations (triggers GiST EXCLUDE check)
        await tx.insert(appointmentServiceAllocations).values(
          insertedServices.map((svc, i) => {
            const seg = data.segments[i];
            if (!seg) {
              throw new Error('Internal invariant: segment mismatch.');
            }
            return {
              businessId: data.businessId,
              appointmentId: appt.id,
              appointmentServiceId: svc.id,
              staffMemberId: seg.staffMemberId,
              occupiedPeriod:
                sql`tstzrange(${seg.occupiedStart.toISOString()}, ${seg.occupiedEnd.toISOString()}, '[)')` as unknown as string,
            };
          }),
        );

        // 4. Insert status history audit log
        await tx.insert(appointmentStatusHistory).values({
          businessId: data.businessId,
          appointmentId: appt.id,
          fromStatus: null,
          toStatus: data.initialStatus,
          reason: 'Initial reservation created.',
          changedByBusinessMemberId: data.createdByBusinessMemberId ?? null,
          changedByUserId: data.createdByUserId ?? null,
        });

        // 5. Construct domain entity
        const segmentEntities: AppointmentSegmentEntity[] = insertedServices.map((svc, i) => {
          const seg = data.segments[i];
          return {
            id: svc.id,
            appointmentId: appt.id,
            serviceId: svc.serviceId,
            staffMemberId: svc.staffMemberId,
            serviceName: svc.serviceName,
            staffName: svc.staffName,
            unitPrice: svc.unitPrice,
            durationMinutes: svc.durationMinutes,
            processingTimeMinutes: 0,
            extraTimeMinutes: 0,
            bufferBeforeMinutes: seg?.bufferBeforeMinutes ?? 0,
            bufferAfterMinutes: seg?.bufferAfterMinutes ?? 0,
            startsAt: svc.startsAt,
            endsAt: svc.endsAt,
            sequence: svc.sequence,
            notes: svc.notes,
          };
        });

        return {
          id: appt.id,
          businessId: appt.businessId,
          branchId: appt.branchId,
          businessCustomerId: appt.businessCustomerId,
          status: appt.status as AppointmentStatus,
          bookingChannel: appt.bookingChannel as BookingChannel,
          scheduledStartAt: appt.scheduledStartAt,
          scheduledEndAt: appt.scheduledEndAt,
          createdByUserId: appt.createdByUserId ?? null,
          createdByBusinessMemberId: appt.createdByBusinessMemberId ?? null,
          segments: segmentEntities,
          createdAt: appt.createdAt,
          updatedAt: appt.updatedAt,
        };
      });
    } catch (error: unknown) {
      throw handleExclusionViolation(error, {
        no_staff_time_overlap:
          'The selected time slot is no longer available. Please choose a different time or staff member.',
      });
    }
  }

  async findById(
    businessId: string,
    appointmentId: string,
    branchId?: string,
  ): Promise<AppointmentEntity | null> {
    const conditions = [
      eq(appointments.businessId, businessId),
      eq(appointments.id, appointmentId),
    ];
    if (branchId) {
      conditions.push(eq(appointments.branchId, branchId));
    }

    const appt = await this.db.query.appointments.findFirst({
      where: and(...conditions),
      with: {
        services: {
          orderBy: (s, { asc }) => [asc(s.sequence)],
        },
      },
    });

    if (!appt) return null;
    return this.toDomainEntity(appt, appt.services);
  }

  async findAll(
    businessId: string,
    filters: AppointmentFilters,
  ): Promise<{ appointments: AppointmentEntity[]; total: number }> {
    const conditions = [eq(appointments.businessId, businessId)];

    if (filters.branchId) {
      conditions.push(eq(appointments.branchId, filters.branchId));
    }
    if (filters.businessCustomerId) {
      conditions.push(eq(appointments.businessCustomerId, filters.businessCustomerId));
    }
    if (filters.status) {
      conditions.push(eq(appointments.status, filters.status));
    }
    if (filters.startDate) {
      conditions.push(gte(appointments.scheduledStartAt, filters.startDate));
    }
    if (filters.endDate) {
      conditions.push(lte(appointments.scheduledStartAt, filters.endDate));
    }
    const whereClause = and(...conditions);

    const [countResult] = await this.db
      .select({ total: count() })
      .from(appointments)
      .where(whereClause);

    const total = Number(countResult?.total ?? 0);

    const rows = await this.db.query.appointments.findMany({
      where: whereClause,
      orderBy: [desc(appointments.scheduledStartAt)],
      limit: filters.limit ?? 50,
      offset: filters.offset ?? 0,
      with: {
        services: {
          orderBy: (s, { asc }) => [asc(s.sequence)],
        },
      },
    });

    return {
      appointments: rows.map((r) => this.toDomainEntity(r, r.services)),
      total,
    };
  }

  async cancel(data: CancelAppointmentData): Promise<AppointmentEntity> {
    return await this.db.transaction(async (tx) => {
      const conditions = [
        eq(appointments.businessId, data.businessId),
        eq(appointments.id, data.appointmentId),
      ];
      if (data.branchId) {
        conditions.push(eq(appointments.branchId, data.branchId));
      }

      const appt = await tx.query.appointments.findFirst({
        where: and(...conditions),
        with: {
          services: {
            orderBy: (s, { asc }) => [asc(s.sequence)],
          },
        },
      });

      if (!appt) {
        throw new ResourceNotFoundError(
          `Appointment ${data.appointmentId} not found in this business`,
        );
      }

      const currentStatus = appt.status as AppointmentStatus;
      if (!canTransitionStatus(currentStatus, 'cancelled')) {
        throw new ConflictError(
          `Cannot cancel appointment in status "${currentStatus}". Only pending, confirmed, or checked_in appointments can be cancelled.`,
        );
      }

      const now = new Date();

      const [updated] = await tx
        .update(appointments)
        .set({
          status: 'cancelled',
          cancellationReason: data.cancellationReason ?? null,
          cancelledAt: now,
          cancelledByUserId: data.cancelledByUserId ?? null,
          cancelledByBusinessMemberId: data.cancelledByBusinessMemberId ?? null,
          updatedAt: now,
        })
        .where(and(...conditions, eq(appointments.status, currentStatus)))
        .returning();

      if (!updated) {
        throw new ConflictError(
          'Appointment status changed concurrently — please retry the operation.',
        );
      }

      await tx.insert(appointmentStatusHistory).values({
        businessId: data.businessId,
        appointmentId: data.appointmentId,
        fromStatus: currentStatus,
        toStatus: 'cancelled',
        reason: data.cancellationReason ?? null,
        changedByUserId: data.cancelledByUserId ?? null,
        changedByBusinessMemberId: data.cancelledByBusinessMemberId ?? null,
      });

      await tx
        .delete(appointmentServiceAllocations)
        .where(
          and(
            eq(appointmentServiceAllocations.businessId, data.businessId),
            eq(appointmentServiceAllocations.appointmentId, data.appointmentId),
          ),
        );

      return this.toDomainEntity(updated, appt.services);
    });
  }

  async transitionStatus(data: TransitionAppointmentStatusData): Promise<AppointmentEntity> {
    return await this.db.transaction(async (tx) => {
      const conditions = [
        eq(appointments.businessId, data.businessId),
        eq(appointments.id, data.appointmentId),
      ];
      if (data.branchId) {
        conditions.push(eq(appointments.branchId, data.branchId));
      }

      const appt = await tx.query.appointments.findFirst({
        where: and(...conditions),
        with: {
          services: {
            orderBy: (s, { asc }) => [asc(s.sequence)],
          },
        },
      });

      if (!appt) {
        throw new ResourceNotFoundError(
          `Appointment ${data.appointmentId} not found in this business`,
        );
      }

      const currentStatus = appt.status as AppointmentStatus;
      if (!canTransitionStatus(currentStatus, data.toStatus)) {
        throw new ConflictError(
          `Cannot transition appointment status from "${currentStatus}" to "${data.toStatus}".`,
        );
      }

      const now = new Date();

      const [updated] = await tx
        .update(appointments)
        .set({
          status: data.toStatus,
          updatedAt: now,
        })
        .where(and(...conditions, eq(appointments.status, currentStatus)))
        .returning();

      if (!updated) {
        throw new ConflictError(
          'Appointment status changed concurrently — please retry the operation.',
        );
      }

      await tx.insert(appointmentStatusHistory).values({
        businessId: data.businessId,
        appointmentId: data.appointmentId,
        fromStatus: currentStatus,
        toStatus: data.toStatus,
        reason: data.reason ?? null,
        changedByUserId: data.actorUserId ?? null,
        changedByBusinessMemberId: data.actorBusinessMemberId ?? null,
      });

      if (!BLOCKING_STATUSES.has(data.toStatus)) {
        await tx
          .delete(appointmentServiceAllocations)
          .where(
            and(
              eq(appointmentServiceAllocations.businessId, data.businessId),
              eq(appointmentServiceAllocations.appointmentId, data.appointmentId),
            ),
          );
      }

      return this.toDomainEntity(updated, appt.services);
    });
  }

  async reschedule(data: RescheduleAppointmentData): Promise<AppointmentEntity> {
    // ── 1. Fetch current appointment and validate state (OUTSIDE TX) ───────
    const conditions = [
      eq(appointments.businessId, data.businessId),
      eq(appointments.id, data.appointmentId),
    ];
    if (data.branchId) {
      conditions.push(eq(appointments.branchId, data.branchId));
    }

    const appt = await this.db.query.appointments.findFirst({
      where: and(...conditions),
      with: {
        services: {
          orderBy: (s, { asc }) => [asc(s.sequence)],
        },
      },
    });

    if (!appt) {
      throw new ResourceNotFoundError(
        `Appointment ${data.appointmentId} not found in this business`,
      );
    }

    const currentStatus = appt.status as AppointmentStatus;
    if (
      currentStatus === 'completed' ||
      currentStatus === 'cancelled' ||
      currentStatus === 'no_show'
    ) {
      throw new ConflictError(
        `Cannot reschedule an appointment in terminal status "${currentStatus}".`,
      );
    }

    // ── 2. Derive new sequential segment timings & occupied intervals (OUTSIDE TX) ──
    const timedSegments = computeTimedSegments(
      data.newScheduledStartAt,
      appt.services.map((svc) => ({
        staffMemberId: svc.staffMemberId,
        durationMinutes: svc.durationMinutes,
        bufferBeforeMinutes: svc.bufferBeforeMinutes,
        bufferAfterMinutes: svc.bufferAfterMinutes,
      })),
    );
    const newOverallEnd = timedSegments[timedSegments.length - 1]?.endsAt;

    const plannedSegments = appt.services.map((svc, i) => {
      const timing = timedSegments[i];
      if (!timing) {
        throw new Error('Internal invariant: timing mismatch during reschedule.');
      }
      return {
        svc,
        startsAt: timing.startsAt,
        endsAt: timing.endsAt,
        occupiedStart: timing.occupiedStart,
        occupiedEnd: timing.occupiedEnd,
      };
    });

    try {
      // ── 3. Fast Atomic Write Transaction (<2ms duration) ──────────────────
      return await this.db.transaction(async (tx) => {
        const now = new Date();

        // 1. Update parent appointment times with CAS status guard
        const [updatedAppt] = await tx
          .update(appointments)
          .set({
            scheduledStartAt: data.newScheduledStartAt,
            scheduledEndAt: newOverallEnd,
            updatedAt: now,
          })
          .where(
            and(
              ...conditions,
              // CAS: only reschedule if status and updatedAt have not changed concurrently
              // Microsecond-safe: Postgres timestamptz stores microseconds while JS Date has millisecond precision
              eq(appointments.status, currentStatus),
              sql`date_trunc('milliseconds', ${appointments.updatedAt}) = date_trunc('milliseconds', ${appt.updatedAt}::timestamptz)`,
            ),
          )
          .returning();

        if (!updatedAppt) {
          throw new ConflictError(
            'Appointment status changed concurrently — please retry the operation.',
          );
        }

        // 2. Delete existing allocations for this appointment
        await tx
          .delete(appointmentServiceAllocations)
          .where(
            and(
              eq(appointmentServiceAllocations.businessId, data.businessId),
              eq(appointmentServiceAllocations.appointmentId, data.appointmentId),
            ),
          );

        // 3. Update appointment service times
        const updatedSegments: (typeof appointmentServices.$inferSelect)[] = [];
        for (const plan of plannedSegments) {
          const [updatedSvc] = await tx
            .update(appointmentServices)
            .set({
              startsAt: plan.startsAt,
              endsAt: plan.endsAt,
            })
            .where(
              and(
                eq(appointmentServices.businessId, data.businessId),
                eq(appointmentServices.id, plan.svc.id),
              ),
            )
            .returning();

          if (!updatedSvc) {
            throw new Error('Failed to update appointment service during reschedule.');
          }
          updatedSegments.push(updatedSvc);
        }

        // 4. Batch insert new allocations (triggers GiST EXCLUDE check)
        await tx.insert(appointmentServiceAllocations).values(
          plannedSegments.map((plan) => ({
            businessId: data.businessId,
            appointmentId: data.appointmentId,
            appointmentServiceId: plan.svc.id,
            staffMemberId: plan.svc.staffMemberId,
            occupiedPeriod:
              sql`tstzrange(${plan.occupiedStart.toISOString()}, ${plan.occupiedEnd.toISOString()}, '[)')` as unknown as string,
          })),
        );

        // 5. Append status history note
        await tx.insert(appointmentStatusHistory).values({
          businessId: data.businessId,
          appointmentId: data.appointmentId,
          fromStatus: currentStatus,
          toStatus: currentStatus,
          reason: data.reason ? `Rescheduled: ${data.reason}` : 'Rescheduled appointment time',
          changedByUserId: data.actorUserId ?? null,
          changedByBusinessMemberId: data.actorBusinessMemberId ?? null,
        });

        return this.toDomainEntity(updatedAppt, updatedSegments);
      });
    } catch (error: unknown) {
      throw handleExclusionViolation(error, {
        no_staff_time_overlap:
          'The selected time slot is no longer available. Please choose a different time or staff member.',
      });
    }
  }

  async findOccupiedAllocations(
    businessId: string,
    staffMemberIds: string[],
    start: Date,
    end: Date,
  ): Promise<OccupiedAllocationInterval[]> {
    if (staffMemberIds.length === 0) return [];

    const rows = await this.db.execute(sql`
      SELECT
        staff_member_id,
        lower(occupied_period) AS occupied_start,
        upper(occupied_period) AS occupied_end
      FROM appointment_service_allocations
      WHERE business_id = ${businessId}
        AND staff_member_id IN ${sql`(${sql.join(
          staffMemberIds.map((id) => sql`${id}`),
          sql`, `,
        )})`}
        AND occupied_period && tstzrange(${start.toISOString()}, ${end.toISOString()}, '[)')
    `);

    interface OccupiedRow {
      staff_member_id: string;
      occupied_start: string;
      occupied_end: string;
    }

    return (rows.rows as unknown as OccupiedRow[]).map((r) => ({
      staffMemberId: r.staff_member_id,
      occupiedStart: new Date(r.occupied_start),
      occupiedEnd: new Date(r.occupied_end),
    }));
  }

  async deleteAllocations(businessId: string, appointmentId: string): Promise<void> {
    await this.db
      .delete(appointmentServiceAllocations)
      .where(
        and(
          eq(appointmentServiceAllocations.businessId, businessId),
          eq(appointmentServiceAllocations.appointmentId, appointmentId),
        ),
      );
  }

  private toDomainEntity(
    appt: typeof appointments.$inferSelect,
    services: (typeof appointmentServices.$inferSelect)[],
  ): AppointmentEntity {
    return {
      id: appt.id,
      businessId: appt.businessId,
      branchId: appt.branchId,
      businessCustomerId: appt.businessCustomerId,
      status: appt.status as AppointmentStatus,
      bookingChannel: appt.bookingChannel as BookingChannel,
      scheduledStartAt: appt.scheduledStartAt,
      scheduledEndAt: appt.scheduledEndAt,
      createdByUserId: appt.createdByUserId ?? null,
      createdByBusinessMemberId: appt.createdByBusinessMemberId ?? null,
      cancellationReason: appt.cancellationReason ?? null,
      cancelledAt: appt.cancelledAt ?? null,
      cancelledByUserId: appt.cancelledByUserId ?? null,
      cancelledByBusinessMemberId: appt.cancelledByBusinessMemberId ?? null,
      segments: services.map((svc) => ({
        id: svc.id,
        appointmentId: appt.id,
        serviceId: svc.serviceId,
        staffMemberId: svc.staffMemberId,
        serviceName: svc.serviceName,
        staffName: svc.staffName,
        unitPrice: svc.unitPrice,
        durationMinutes: svc.durationMinutes,
        processingTimeMinutes: svc.processingTimeMinutes,
        extraTimeMinutes: svc.extraTimeMinutes,
        bufferBeforeMinutes: svc.bufferBeforeMinutes,
        bufferAfterMinutes: svc.bufferAfterMinutes,
        startsAt: svc.startsAt,
        endsAt: svc.endsAt,
        sequence: svc.sequence,
        notes: svc.notes ?? null,
      })),
      createdAt: appt.createdAt,
      updatedAt: appt.updatedAt,
    };
  }
}
