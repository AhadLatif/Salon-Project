import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { businesses } from '../business/businesses.js';
import { businessMembers } from '../RBAC/business_members.js';
import { generateId, helperTimeStamp } from '../shared/index.js';
import { reviews } from './reviews.js';

export const responderTypeEnum = pgEnum('responder_type', ['business', 'team_member']);
export const responseVisibilityEnum = pgEnum('response_visibility', ['public', 'private']);

export const reviewResponses = pgTable(
  'review_responses',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => generateId()),

    // The Tenant Boundary you missed!
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),

    reviewId: uuid('review_id').notNull(),
    businessMemberId: uuid('business_member_id').notNull(),

    responderType: responderTypeEnum('responder_type').notNull(),
    visibility: responseVisibilityEnum('visibility').notNull().default('public'),

    body: text('body').notNull(),

    ...helperTimeStamp,
  },
  (table) => [
    index('idx_review_responses_business').on(table.businessId),
    index('idx_review_responses_member').on(table.businessMemberId),

    foreignKey({
      name: 'fk_review_resp_review_tenant',
      columns: [table.businessId, table.reviewId],
      foreignColumns: [reviews.businessId, reviews.id],
    }).onDelete('cascade'),

    foreignKey({
      name: 'fk_review_resp_member_tenant',
      columns: [table.businessId, table.businessMemberId],
      foreignColumns: [businessMembers.businessId, businessMembers.id],
    }).onDelete('restrict'),

    // A review can only receive ONE response
    uniqueIndex('uq_review_responses_review').on(table.reviewId),

    // Prevent empty responses
    check('chk_review_responses_body', sql`length(trim(${table.body})) > 0`),
  ],
);
