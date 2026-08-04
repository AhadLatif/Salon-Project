import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const permissions = pgTable(
  'permissions',
  {
    id: uuid('id').primaryKey(),
    // e.g., 'calendar.view.own', 'appointments.create.all'
    code: text('code').notNull().unique(),
    // e.g., 'Calendar', 'Clients', 'Sales' (Matches Fresha's UI categories)
    module: text('module').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [index('idx_permissions_module').on(table.module)],
);
