import {
  bigint,
  char,
  index,
  pgEnum,
  pgTable,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { businesses } from '../business/businesses.js';
import { users } from '../identity/users.js';
import { generateId, helperTimeStamp } from '../shared/index.js';

export const mediaStatusEnum = pgEnum('media_status', [
  'uploading',
  'available',
  'processing',
  'failed',
  'deleted',
]);

export const mediaFiles = pgTable(
  'media_files',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => generateId()),

    // Nullable because a Platform User (Customer) might upload a profile pic
    // independent of any specific salon.
    businessId: uuid('business_id').references(() => businesses.id, { onDelete: 'cascade' }),

    uploadedByUserId: uuid('uploaded_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),

    originalFilename: varchar('original_filename', { length: 255 }).notNull(),
    storageKey: varchar('storage_key', { length: 512 }).notNull(),
    mimeType: varchar('mime_type', { length: 100 }).notNull(),

    fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }).notNull(),
    checksumSha256: char('checksum_sha256', { length: 64 }).notNull(),

    status: mediaStatusEnum('status').notNull().default('uploading'),

    ...helperTimeStamp,
  },
  (table) => [
    index('idx_media_files_business').on(table.businessId),
    index('idx_media_files_uploader').on(table.uploadedByUserId),
    index('idx_media_files_status').on(table.status),

    // Globally unique storage key
    uniqueIndex('uq_media_files_storage_key').on(table.storageKey),

    // THE MASTER LOCK: Allows child tables to securely reference this file + tenant
    unique('uq_media_files_tenant_id').on(table.businessId, table.id),
  ],
);
