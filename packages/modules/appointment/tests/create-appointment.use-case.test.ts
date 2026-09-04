/**
 * Phase 1 integration tests for CreateAppointmentUseCase.
 *
 * Covers:
 *  - Successful single-service booking (channel → status mapping).
 *  - Multi-service sequential segment timing.
 *  - Buffer-aware occupied period (double-booking with buffers).
 *  - Concurrent double-booking barrier → one succeeds, one gets ConflictError.
 *  - Validation failures (branch / customer / service / staff / member).
 *
 * Pattern follows the customer module tests: real DB via @salon/testing
 * factories + mocked cross-module validator ports.
 */

import { db } from '@salon/database';
import { ConflictError, ForbiddenError, ResourceNotFoundError } from '@salon/shared';
import {
  createTestBranch,
  createTestBusiness,
  createTestCustomer,
  createTestService,
  createTestStaffMember,
  truncateAllTables,
} from '@salon/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CreateAppointmentData } from '../src/application/ports/appointment-repository.port.js';
import type {
  IBranchValidator,
  IBusinessMemberValidator,
  ICustomerValidator,
  IServiceValidator,
  IStaffValidator,
} from '../src/application/ports/appointment-validators.port.js';
import { CreateAppointmentUseCase } from '../src/application/use-cases/create-appointment.use-case.js';
import { AppointmentRepository } from '../src/infrastructure/repositories/appointment.repository.js';

// ── Test fixture setup ─────────────────────────────────────────────────────

interface TestPrereqs {
  businessId: string;
  branchId: string;
  customerId: string;
  serviceId: string;
  staffId: string;
}

async function setupPrerequisites(): Promise<TestPrereqs> {
  const business = await createTestBusiness(db);
  const branch = await createTestBranch(db, { businessId: business.id });
  const customer = await createTestCustomer(db, business.id);
  const service = await createTestService(db, { businessId: business.id });
  const staff = await createTestStaffMember(db, { businessId: business.id });

  return {
    businessId: business.id,
    branchId: branch.id,
    customerId: customer.id,
    serviceId: service.id,
    staffId: staff.id,
  };
}

function buildBookingData(
  p: TestPrereqs,
  overrides: Partial<CreateAppointmentData> = {},
): CreateAppointmentData {
  return {
    businessId: p.businessId,
    branchId: p.branchId,
    businessCustomerId: p.customerId,
    scheduledStartAt: new Date('2030-01-02T10:00:00.000Z'),
    bookingChannel: 'business_dashboard',
    segments: [{ serviceId: p.serviceId, staffMemberId: p.staffId }],
    ...overrides,
  };
}

// ── Synchronization barrier for concurrency tests ──────────────────────────

/** Releases both callers simultaneously so they enter the DB transaction together. */
function createBarrier() {
  const participants = 2;
  let arrived = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  return {
    enter: () => {
      arrived++;
      if (arrived >= participants) release();
      return gate;
    },
  };
}

// ── Stub factories for cross-module validator ports ───────────────────────

interface StubOverrides {
  branchInBusiness?: boolean;
  customerInBusiness?: boolean;
  staffActive?: boolean;
  serviceInBusiness?: boolean;
  memberInBusiness?: boolean;
}

function createStubValidators(overrides: StubOverrides = {}): {
  branchValidator: IBranchValidator;
  customerValidator: ICustomerValidator;
  staffValidator: IStaffValidator;
  serviceValidator: IServiceValidator;
  businessMemberValidator: IBusinessMemberValidator;
} {
  const v = {
    branchInBusiness: true,
    customerInBusiness: true,
    staffActive: true,
    serviceInBusiness: true,
    memberInBusiness: true,
    ...overrides,
  };
  return {
    branchValidator: {
      isBranchInBusiness: async () => v.branchInBusiness,
      getBranchOpeningHoursForDay: async () => ({
        dayOfWeek: 3,
        isClosed: false,
        opensAt: '09:00:00',
        closesAt: '18:00:00',
      }),
    } satisfies IBranchValidator,
    customerValidator: {
      isCustomerInBusiness: async () => v.customerInBusiness,
    } satisfies ICustomerValidator,
    staffValidator: {
      isStaffMemberActive: async () => v.staffActive,
      getStaffBookingSnapshots: async (_bId, requests) => {
        const results = [];
        for (const req of requests) {
          const [staff] = await db.query.staffMembers.findMany({
            where: (table, { eq }) => eq(table.id, req.staffMemberId),
            limit: 1,
          });
          results.push({
            staffMemberId: req.staffMemberId,
            serviceId: req.serviceId,
            displayName: staff?.displayName ?? 'Jane Doe',
            isActive: v.staffActive && Boolean(staff && staff.status === 'active'),
            overridePrice: null,
            overrideDurationMinutes: null,
            isBookable: true,
          });
        }
        return results;
      },
      getStaffAvailabilitySchedule: async (_bId, criteria) => [
        {
          staffMemberId: criteria.staffMemberId ?? 'stub',
          overrideDurationMinutes: null,
          shifts: [{ startsAt: '00:00:00', endsAt: '23:59:59' }],
          timeOff: [],
        },
      ],
    } satisfies IStaffValidator,
    serviceValidator: {
      isServiceInBusiness: async () => v.serviceInBusiness,
      isServiceBookableAtBranch: async () => true,
      getServiceSnapshots: async (_bId, serviceIds) => {
        const results = [];
        for (const sId of serviceIds) {
          const [svc] = await db.query.services.findMany({
            where: (table, { eq }) => eq(table.id, sId),
            limit: 1,
          });
          if (svc && v.serviceInBusiness) {
            results.push({
              id: svc.id,
              name: svc.name,
              defaultPrice: svc.defaultPrice,
              defaultDurationMinutes: svc.defaultDurationMinutes,
              bufferBeforeMinutes: svc.bufferBeforeMinutes,
              bufferAfterMinutes: svc.bufferAfterMinutes,
              isActive: svc.isActive,
            });
          }
        }
        return results;
      },
      getServiceDetails: async (_bId, serviceId) => {
        const [svc] = await db.query.services.findMany({
          where: (table, { eq }) => eq(table.id, serviceId),
          limit: 1,
        });
        if (!svc) return null;
        return {
          id: svc.id,
          name: svc.name,
          defaultPrice: svc.defaultPrice,
          defaultDurationMinutes: svc.defaultDurationMinutes,
          bufferBeforeMinutes: svc.bufferBeforeMinutes,
          bufferAfterMinutes: svc.bufferAfterMinutes,
          isActive: svc.isActive,
        };
      },
    } satisfies IServiceValidator,
    businessMemberValidator: {
      isBusinessMemberInBusiness: async () => v.memberInBusiness,
    } satisfies IBusinessMemberValidator,
  };
}

function buildUseCase(stubs: ReturnType<typeof createStubValidators>) {
  return new CreateAppointmentUseCase(
    new AppointmentRepository(db),
    stubs.branchValidator,
    stubs.customerValidator,
    stubs.staffValidator,
    stubs.serviceValidator,
    stubs.businessMemberValidator,
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('CreateAppointmentUseCase — Phase 1 reservation foundation', () => {
  let useCase: CreateAppointmentUseCase;

  beforeEach(async () => {
    await truncateAllTables(db);
    useCase = buildUseCase(createStubValidators());
  });

  afterEach(async () => {
    await truncateAllTables(db);
  });

  // ── Successful booking ────────────────────────────────────────────────────

  it('creates a confirmed appointment for business_dashboard channel', async () => {
    const p = await setupPrerequisites();
    const result = await useCase.execute(buildBookingData(p));

    expect(result.id).toBeDefined();
    expect(result.businessId).toBe(p.businessId);
    expect(result.branchId).toBe(p.branchId);
    expect(result.businessCustomerId).toBe(p.customerId);
    expect(result.status).toBe('confirmed');
    expect(result.bookingChannel).toBe('business_dashboard');
    expect(result.scheduledStartAt).toEqual(new Date('2030-01-02T10:00:00.000Z'));
    expect(result.scheduledEndAt).toEqual(new Date('2030-01-02T11:00:00.000Z'));
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0]?.serviceName).toBeDefined();
    expect(result.segments[0]?.staffName).toBeDefined();
    expect(result.segments[0]?.unitPrice).toBe('50.00');
    expect(result.segments[0]?.durationMinutes).toBe(60);
    expect(result.segments[0]?.sequence).toBe(1);
  });

  it('creates a pending appointment for marketplace channel', async () => {
    const p = await setupPrerequisites();
    const result = await useCase.execute(buildBookingData(p, { bookingChannel: 'marketplace' }));

    expect(result.status).toBe('pending');
    expect(result.bookingChannel).toBe('marketplace');
  });

  it('creates a confirmed appointment for walk_in channel', async () => {
    const p = await setupPrerequisites();
    const result = await useCase.execute(buildBookingData(p, { bookingChannel: 'walk_in' }));

    expect(result.status).toBe('confirmed');
  });

  it('computes sequential segment times for multi-service bookings', async () => {
    const p = await setupPrerequisites();
    const service2 = await createTestService(db, {
      businessId: p.businessId,
      defaultDurationMinutes: 30,
      defaultPrice: '30.00',
    });

    // 60-min + 30-min segments: 10:00-11:00, 11:00-11:30
    const result = await useCase.execute({
      ...buildBookingData(p),
      segments: [
        { serviceId: p.serviceId, staffMemberId: p.staffId },
        { serviceId: service2.id, staffMemberId: p.staffId },
      ],
    });

    expect(result.scheduledStartAt).toEqual(new Date('2030-01-02T10:00:00.000Z'));
    expect(result.scheduledEndAt).toEqual(new Date('2030-01-02T11:30:00.000Z'));
    expect(result.segments).toHaveLength(2);
    expect(result.segments[0]?.startsAt).toEqual(new Date('2030-01-02T10:00:00.000Z'));
    expect(result.segments[0]?.endsAt).toEqual(new Date('2030-01-02T11:00:00.000Z'));
    expect(result.segments[1]?.startsAt).toEqual(new Date('2030-01-02T11:00:00.000Z'));
    expect(result.segments[1]?.endsAt).toEqual(new Date('2030-01-02T11:30:00.000Z'));
  });

  it('correctly maps service-specific staff overrides when same staff performs multiple services', async () => {
    const p = await setupPrerequisites();
    const service2 = await createTestService(db, {
      businessId: p.businessId,
      defaultDurationMinutes: 30,
      defaultPrice: '80.00',
    });

    const stubs = createStubValidators();
    stubs.staffValidator.getStaffBookingSnapshots = async (_bId, requests) =>
      requests.map((req) => ({
        staffMemberId: req.staffMemberId,
        serviceId: req.serviceId,
        displayName: 'Specialist Alex',
        overridePrice: req.serviceId === p.serviceId ? '40.00' : '75.00',
        overrideDurationMinutes: req.serviceId === p.serviceId ? 50 : 25,
        isActive: true,
        isBookable: true,
      }));

    const customUseCase = buildUseCase(stubs);
    const result = await customUseCase.execute({
      ...buildBookingData(p),
      segments: [
        { serviceId: p.serviceId, staffMemberId: p.staffId },
        { serviceId: service2.id, staffMemberId: p.staffId },
      ],
    });

    expect(result.segments).toHaveLength(2);
    expect(result.segments[0]?.unitPrice).toBe('40.00');
    expect(result.segments[0]?.durationMinutes).toBe(50);
    expect(result.segments[1]?.unitPrice).toBe('75.00');
    expect(result.segments[1]?.durationMinutes).toBe(25);
  });

  // ── Double-booking barrier ────────────────────────────────────────────

  it('only one of two concurrent bookings for same staff/time succeeds', async () => {
    const p = await setupPrerequisites();
    const booking = buildBookingData(p);
    const barrier = createBarrier();

    const results = await Promise.allSettled([
      (async () => {
        await barrier.enter();
        return useCase.execute(booking);
      })(),
      (async () => {
        await barrier.enter();
        return useCase.execute(booking);
      })(),
    ]);

    const succeeded = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected');

    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(1);

    const failure = (failed[0] as PromiseRejectedResult).reason;
    expect(failure).toBeInstanceOf(ConflictError);
    expect(failure.message).toContain('no longer available');
  });

  it('allows non-overlapping bookings for the same staff', async () => {
    const p = await setupPrerequisites();

    const early = await useCase.execute(buildBookingData(p));
    expect(early.status).toBe('confirmed');

    // Starts exactly when the first ends (10:00-11:00, then 11:00-12:00)
    const late = await useCase.execute(
      buildBookingData(p, {
        scheduledStartAt: new Date('2030-01-02T11:00:00.000Z'),
      }),
    );
    expect(late.status).toBe('confirmed');
  });

  it('prevents booking that overlaps when buffers are present', async () => {
    const p = await setupPrerequisites();
    const serviceWithBuffer = await createTestService(db, {
      businessId: p.businessId,
      defaultDurationMinutes: 60,
      bufferAfterMinutes: 30,
    });

    // First booking: 10:00-11:00, but occupied until 11:30 due to buffer
    await useCase.execute(
      buildBookingData(p, {
        scheduledStartAt: new Date('2030-01-02T10:00:00.000Z'),
        segments: [{ serviceId: serviceWithBuffer.id, staffMemberId: p.staffId }],
      }),
    );

    // Second booking starts at 11:00 — overlaps with buffer [10:00, 11:30)
    await expect(
      useCase.execute(
        buildBookingData(p, {
          scheduledStartAt: new Date('2030-01-02T11:00:00.000Z'),
          segments: [{ serviceId: serviceWithBuffer.id, staffMemberId: p.staffId }],
        }),
      ),
    ).rejects.toThrow(ConflictError);
  });

  it('allows booking immediately after the buffered occupied period ends', async () => {
    const p = await setupPrerequisites();
    const serviceWithBuffer = await createTestService(db, {
      businessId: p.businessId,
      defaultDurationMinutes: 60,
      bufferAfterMinutes: 30,
    });

    // First booking: 10:00-11:00, occupied until 11:30
    await useCase.execute(
      buildBookingData(p, {
        scheduledStartAt: new Date('2030-01-02T10:00:00.000Z'),
        segments: [{ serviceId: serviceWithBuffer.id, staffMemberId: p.staffId }],
      }),
    );

    // [) boundary: 11:30 is exclusive end of first range,
    // inclusive start of second → no overlap
    const result = await useCase.execute(
      buildBookingData(p, {
        scheduledStartAt: new Date('2030-01-02T11:30:00.000Z'),
        segments: [{ serviceId: serviceWithBuffer.id, staffMemberId: p.staffId }],
      }),
    );
    expect(result.status).toBe('confirmed');
  });

  // ── Validation failures ──────────────────────────────────────────────

  it('throws ResourceNotFoundError when branch does not belong to the business', async () => {
    const p = await setupPrerequisites();
    const uc = buildUseCase(createStubValidators({ branchInBusiness: false }));

    await expect(uc.execute(buildBookingData(p))).rejects.toThrow(ResourceNotFoundError);
  });

  it('throws ResourceNotFoundError when customer does not belong to the business', async () => {
    const p = await setupPrerequisites();
    const uc = buildUseCase(createStubValidators({ customerInBusiness: false }));

    await expect(uc.execute(buildBookingData(p))).rejects.toThrow(ResourceNotFoundError);
  });

  it('throws ConflictError when staff member is not active', async () => {
    const p = await setupPrerequisites();
    const uc = buildUseCase(createStubValidators({ staffActive: false }));

    await expect(uc.execute(buildBookingData(p))).rejects.toThrow(ConflictError);
  });

  it('throws ResourceNotFoundError when service does not belong to the business', async () => {
    const p = await setupPrerequisites();
    const uc = buildUseCase(createStubValidators({ serviceInBusiness: false }));

    await expect(uc.execute(buildBookingData(p))).rejects.toThrow(ResourceNotFoundError);
  });

  it('throws ForbiddenError when createdByBusinessMemberId does not belong to business', async () => {
    const p = await setupPrerequisites();
    const uc = buildUseCase(createStubValidators({ memberInBusiness: false }));

    await expect(
      uc.execute({
        ...buildBookingData(p),
        createdByBusinessMemberId: '00000000-0000-0000-0000-000000000000',
      }),
    ).rejects.toThrow(ForbiddenError);
  });
});
