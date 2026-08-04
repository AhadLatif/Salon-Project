import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { branches } from '../business/branches.js';
import { businesses } from '../business/businesses.js';
import { businessCustomers } from '../customer/business_customers.js';
import { users } from '../identity/users.js';
import { businessMembers } from '../RBAC/business_members.js';
import { generateId, helperTimeStamp } from '../shared/index.js';

export const appointmentStatusEnum = pgEnum('appointment_status', [
  'pending',
  'confirmed',
  'checked_in',
  'in_progress',
  'completed',
  'cancelled',
  'no_show',
]);

export const bookingChannelEnum = pgEnum('booking_channel', [
  'marketplace',
  'business_dashboard',
  'walk_in',
]);

export const appointments = pgTable(
  'appointments',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => generateId()),

    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id').notNull(),
    businessCustomerId: uuid('business_customer_id').notNull(),

    status: appointmentStatusEnum('status').notNull().default('pending'),
    bookingChannel: bookingChannelEnum('booking_channel').notNull(),

    scheduledStartAt: timestamp('scheduled_start_at', {
      withTimezone: true,
      mode: 'date',
    }).notNull(),
    scheduledEndAt: timestamp('scheduled_end_at', { withTimezone: true, mode: 'date' }).notNull(),

    // Who created this appointment?
    createdByUserId: uuid('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdByBusinessMemberId: uuid('created_by_business_member_id').references(
      () => businessMembers.id,
      { onDelete: 'set null' },
    ),

    // Cancellation Data
    cancellationReason: text('cancellation_reason'),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true, mode: 'date' }),
    cancelledByUserId: uuid('cancelled_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    cancelledByBusinessMemberId: uuid('cancelled_by_business_member_id').references(
      () => businessMembers.id,
      { onDelete: 'set null' },
    ),

    ...helperTimeStamp,
  },
  (table) => [
    index('idx_appointments_business').on(table.businessId),
    index('idx_appointments_branch').on(table.branchId),
    index('idx_appointments_customer').on(table.businessCustomerId),
    index('idx_appointments_status').on(table.status),
    index('idx_appointments_start_time').on(table.scheduledStartAt),

    foreignKey({
      name: 'fk_appointment_branch_tenant',
      columns: [table.businessId, table.branchId],
      foreignColumns: [branches.businessId, branches.id],
    }).onDelete('restrict'),

    foreignKey({
      name: 'fk_appointment_customer_tenant',
      columns: [table.businessId, table.businessCustomerId],
      foreignColumns: [businessCustomers.businessId, businessCustomers.id],
    }).onDelete('restrict'),

    unique('uq_appointments_tenant_id').on(table.businessId, table.id),

    // Constraints
    check('chk_appointments_schedule', sql`${table.scheduledEndAt} > ${table.scheduledStartAt}`),
    check(
      'chk_appointments_cancelled',
      sql`(${table.status} <> 'cancelled') OR (${table.cancelledAt} IS NOT NULL)`,
    ),
  ],
);
