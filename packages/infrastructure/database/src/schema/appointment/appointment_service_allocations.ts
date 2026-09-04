import { customType, foreignKey, index, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { generateId } from '../shared/index.js';
import { staffMembers } from '../staff/staff_members.js';
import { appointmentServices } from './appointment_services.js';
import { appointments } from './appointments.js';

/**
 * PostgreSQL range type mapping for Drizzle.
 *
 * `tstzrange` represents a half-open `[start, end)` interval of timestamps with
 * time zone. We deliberately expose it as a string: this table is written by the
 * booking transaction (which builds ranges via `tstzrange(...)` SQL) and read
 * back through raw range SQL — we do NOT rely on Drizzle's typed insert/select
 * for the range value in the MVP.
 *
 * The GiST EXCLUDE constraint that makes double-booking impossible is added by
 * migration `0008` (Drizzle cannot express `EXCLUDE USING gist` in table defs).
 */
export const tstzrange = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'tstzrange';
  },
});

/**
 * CURRENTLY-OCCUPIED STAFF TIME (the reservation layer).
 *
 * Separates the *active* booking's occupied intervals from the historical snapshot
 * (`appointment_services`, which is immutable and kept forever). Rows are created
 * when an appointment is booked and deleted in the SAME transaction that moves the
 * parent appointment to a terminal state (completed / cancelled / no_show), so the
 * GiST exclusion constraint `no_staff_time_overlap` stays unconditionally true.
 */
export const appointmentServiceAllocations = pgTable(
  'appointment_service_allocations',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => generateId()),

    // Tenant boundary. Note: no standalone FK on business_id by itself — the three
    // composite tenant FKs below are what actually enforce per-tenant isolation
    // (ADR-009 pattern, same as appointment_services / appointment_status_history).
    businessId: uuid('business_id').notNull(),

    appointmentId: uuid('appointment_id').notNull(),
    appointmentServiceId: uuid('appointment_service_id').notNull(),
    staffMemberId: uuid('staff_member_id').notNull(),

    // The effective occupied interval INCLUDING buffers: [start − before, end + after)
    occupiedPeriod: tstzrange('occupied_period').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    // B-tree indexes on the child-side FK columns so ON DELETE CASCADE on the
    // parent (appointments / appointment_services) does not require a seq scan.
    index('idx_allocations_appointment').on(table.businessId, table.appointmentId),
    index('idx_allocations_appointment_service').on(table.businessId, table.appointmentServiceId),

    foreignKey({
      name: 'fk_allocation_appointment_tenant',
      columns: [table.businessId, table.appointmentId],
      foreignColumns: [appointments.businessId, appointments.id],
    }).onDelete('cascade'),

    foreignKey({
      name: 'fk_allocation_appointment_service_tenant',
      columns: [table.businessId, table.appointmentServiceId],
      foreignColumns: [appointmentServices.businessId, appointmentServices.id],
    }).onDelete('cascade'),

    foreignKey({
      name: 'fk_allocation_staff_tenant',
      columns: [table.businessId, table.staffMemberId],
      foreignColumns: [staffMembers.businessId, staffMembers.id],
    }).onDelete('restrict'),
  ],
);
