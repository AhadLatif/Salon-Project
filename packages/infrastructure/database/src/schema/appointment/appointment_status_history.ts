import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { businesses } from '../business/businesses.js';
import { users } from '../identity/users.js';
import { businessMembers } from '../RBAC/business_members.js';
import { generateId } from '../shared/index.js';
import { appointmentStatusEnum, appointments } from './appointments.js';

export const appointmentStatusHistory = pgTable(
  'appointment_status_history',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => generateId()),

    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }), // Tenant Boundary
    appointmentId: uuid('appointment_id')
      .notNull()
      .references(() => appointments.id, { onDelete: 'cascade' }),

    fromStatus: appointmentStatusEnum('from_status'), // Nullable for initial creation
    toStatus: appointmentStatusEnum('to_status').notNull(),

    changedByBusinessMemberId: uuid('changed_by_business_member_id').references(
      () => businessMembers.id,
      { onDelete: 'set null' },
    ),
    changedByUserId: uuid('changed_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),

    reason: text('reason'),

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_appt_history_business').on(table.businessId),
    index('idx_appt_history_appointment').on(table.appointmentId),
  ],
);
