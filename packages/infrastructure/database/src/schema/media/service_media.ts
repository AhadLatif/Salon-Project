import {
  boolean,
  foreignKey,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  uuid,
} from 'drizzle-orm/pg-core';
import { businesses } from '../business/businesses.js';
import { services } from '../service/services.js';
import { mediaFiles } from './media_files.js';

export const serviceMediaPurposeEnum = pgEnum('service_media_purpose', [
  'cover_image',
  'gallery_image',
]);

export const serviceMedia = pgTable(
  'service_media',
  {
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    serviceId: uuid('service_id').notNull(),
    mediaFileId: uuid('media_file_id').notNull(),

    purpose: serviceMediaPurposeEnum('purpose').notNull(),
    sortOrder: integer('sort_order').default(0),
    isPrimary: boolean('is_primary').notNull().default(false),
  },
  (table) => [
    primaryKey({ columns: [table.serviceId, table.mediaFileId] }),

    // THE COMPOSITE LOCK: Guarantees the Service and the Media belong to the SAME Salon!
    foreignKey({
      columns: [table.businessId, table.serviceId],
      foreignColumns: [services.businessId, services.id],
    }),
    foreignKey({
      columns: [table.businessId, table.mediaFileId],
      foreignColumns: [mediaFiles.businessId, mediaFiles.id],
    }),
  ],
);
