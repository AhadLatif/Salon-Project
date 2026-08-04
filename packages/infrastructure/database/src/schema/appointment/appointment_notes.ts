import { index, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { businesses } from '../business/businesses.js';
import { businessMembers } from '../RBAC/business_members.js';
import { generateId, helperTimeStamp } from '../shared/index.js';
import { appointments } from './appointments.js';

export const appointmentNotes = pgTable(
  'appointment_notes',
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

    authorId: uuid('author_id').references(() => businessMembers.id, { onDelete: 'set null' }),

    note: text('note').notNull(),

    ...helperTimeStamp,
  },
  (table) => [
    index('idx_appt_notes_appointment').on(table.appointmentId),
    index('idx_appt_notes_author').on(table.authorId),
  ],
);
