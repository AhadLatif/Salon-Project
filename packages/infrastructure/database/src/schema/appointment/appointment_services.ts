import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { businesses } from '../business/businesses.js';
import { services } from '../service/services.js';
import { generateId } from '../shared/index.js';
import { staffMembers } from '../staff/staff_members.js';
import { appointments } from './appointments.js';

export const appointmentServices = pgTable(
  'appointment_services',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => generateId()),

    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }), // Tenant Boundary
    appointmentId: uuid('appointment_id').notNull(),
    serviceId: uuid('service_id').notNull(),
    staffMemberId: uuid('staff_member_id').notNull(),

    // IMMUTABLE SNAPSHOTS
    serviceName: text('service_name').notNull(),
    staffName: text('staff_name').notNull(),
    unitPrice: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
    durationMinutes: smallint('duration_minutes').notNull(),
    processingTimeMinutes: smallint('processing_time_minutes').notNull().default(0),
    extraTimeMinutes: smallint('extra_time_minutes').notNull().default(0),
    bufferBeforeMinutes: smallint('buffer_before_minutes').notNull().default(0),
    bufferAfterMinutes: smallint('buffer_after_minutes').notNull().default(0),

    // Actual execution times for this specific professional
    startsAt: timestamp('starts_at', { withTimezone: true, mode: 'date' }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true, mode: 'date' }).notNull(),

    sequence: smallint('sequence').notNull(),
    notes: text('notes'),

    // Created At handles the audit timestamp
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_appt_services_business').on(table.businessId),
    index('idx_appt_services_appointment').on(table.appointmentId),
    index('idx_appt_services_staff').on(table.staffMemberId),
    index('idx_appt_services_starts').on(table.startsAt),

    foreignKey({
      name: 'fk_app_svc_appointment_tenant',
      columns: [table.businessId, table.appointmentId],
      foreignColumns: [appointments.businessId, appointments.id],
    }).onDelete('cascade'),

    foreignKey({
      name: 'fk_app_svc_service_tenant',
      columns: [table.businessId, table.serviceId],
      foreignColumns: [services.businessId, services.id],
    }).onDelete('restrict'),

    foreignKey({
      name: 'fk_app_svc_staff_tenant',
      columns: [table.businessId, table.staffMemberId],
      foreignColumns: [staffMembers.businessId, staffMembers.id],
    }).onDelete('restrict'),

    uniqueIndex('uq_appt_services_sequence').on(table.appointmentId, table.sequence),

    check('chk_appt_services_price', sql`${table.unitPrice} >= 0`),
    check('chk_appt_services_duration', sql`${table.durationMinutes} > 0`),
    check('chk_appt_services_schedule', sql`${table.endsAt} > ${table.startsAt}`),
  ],
);
