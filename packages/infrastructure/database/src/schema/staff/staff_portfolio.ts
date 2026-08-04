// packages/infrastructure/database/src/schema/staff_portfolio.ts

import { foreignKey, index, integer, pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core';
import { businesses } from '../business/businesses.js';
import { mediaFiles } from '../media/media_files.js';
import { services } from '../service/services.js';
import { staffMembers } from './staff_members.js';

export const staffPortfolio = pgTable(
  'staff_portfolio',
  {
    // The Tenant Boundary
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),

    staffMemberId: uuid('staff_member_id').notNull(),
    mediaFileId: uuid('media_file_id').notNull(),

    // Fresha's "Service Tag" feature (Nullable for 'Untagged' photos)
    serviceId: uuid('service_id'),

    caption: text('caption'),
    displayOrder: integer('display_order').notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.staffMemberId, table.mediaFileId] }),

    index('idx_portfolio_business').on(table.businessId),
    index('idx_portfolio_service').on(table.serviceId),

    // THE COMPOSITE LOCKS: Absolute Multi-Tenant Security
    foreignKey({
      columns: [table.businessId, table.staffMemberId],
      foreignColumns: [staffMembers.businessId, staffMembers.id],
    }),
    foreignKey({
      columns: [table.businessId, table.mediaFileId],
      foreignColumns: [mediaFiles.businessId, mediaFiles.id],
    }),
    // If a service is tagged, it MUST belong to the same salon
    foreignKey({
      columns: [table.businessId, table.serviceId],
      foreignColumns: [services.businessId, services.id],
    }),
  ],
);
