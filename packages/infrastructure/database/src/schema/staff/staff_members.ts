import {
  boolean,
  date,
  foreignKey,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { businesses } from '../business/businesses.js';
import { businessMembers } from '../RBAC/business_members.js';
import { generateId, helperTimeStamp } from '../shared/index.js';

export const staffStatusEnum = pgEnum('staff_status', ['active', 'inactive', 'terminated']);
export const employmentTypeEnum = pgEnum('employment_type', [
  'full_time',
  'part_time',
  'contractor',
]);

export const staffMembers = pgTable(
  'staff_members',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => generateId()),

    // Tenant Boundary (IDOR Protection)
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),

    // Links to the global RBAC/Identity profile
    businessMemberId: uuid('business_member_id').notNull(),

    status: staffStatusEnum('status').notNull().default('active'),
    displayName: text('display_name').notNull(),
    jobTitle: text('job_title'),
    biography: text('biography'),

    // Future FK to media_assets, leaving as UUID for now
    avatarMediaId: uuid('avatar_media_id'),

    employmentType: employmentTypeEnum('employment_type').notNull().default('full_time'),
    hireDate: date('hire_date'),

    // Fresha's Advanced Booking Toggle
    excludeFromAutoAssignment: boolean('exclude_from_auto_assignment').notNull().default(false),

    // Fresha's Rich Profile Data
    languages: text('languages').array(), // e.g., ['English', 'Spanish']
    socialLinks: jsonb('social_links'), // e.g., { instagram: '@barber_ahmed', tiktok: '...' }

    ...helperTimeStamp,
  },
  (table) => [
    index('idx_staff_members_business').on(table.businessId),
    index('idx_staff_members_status').on(table.status),
    index('idx_staff_members_exclude_from_auto_assignment').on(table.excludeFromAutoAssignment),

    foreignKey({
      name: 'fk_staff_business_member_tenant',
      columns: [table.businessId, table.businessMemberId],
      foreignColumns: [businessMembers.businessId, businessMembers.id],
    }).onDelete('cascade'),

    // A business member can only have ONE staff profile per business
    uniqueIndex('uq_staff_business_member').on(table.businessId, table.businessMemberId),

    unique('uq_staff_tenant_id').on(table.businessId, table.id),
  ],
);
