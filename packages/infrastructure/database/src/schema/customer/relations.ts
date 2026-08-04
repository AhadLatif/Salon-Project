import { relations } from 'drizzle-orm';
import { businesses } from '../business/businesses.js';
import { users } from '../identity/users.js';
import { businessMembers } from '../RBAC/business_members.js';
import { businessCustomers } from './business_customers.js';
import { customerNotes } from './customer_notes.js';
import { customerTagAssignments } from './customer_tag_assignments.js';
import { customerTags } from './customer_tags.js';

// --- Business Customers (The Tenant CRM Profile) ---
export const businessCustomersRelations = relations(businessCustomers, ({ one, many }) => ({
  business: one(businesses, {
    fields: [businessCustomers.businessId],
    references: [businesses.id],
  }),
  // Optional link to the global platform user (for claimed accounts)
  user: one(users, {
    fields: [businessCustomers.userId],
    references: [users.id],
  }),
  // Downstream relationships
  notes: many(customerNotes),
  tagAssignments: many(customerTagAssignments),
}));

// --- Customer Notes (Internal CRM History) ---
export const customerNotesRelations = relations(customerNotes, ({ one }) => ({
  business: one(businesses, {
    fields: [customerNotes.businessId],
    references: [businesses.id],
  }),
  customer: one(businessCustomers, {
    fields: [customerNotes.businessCustomerId],
    references: [businessCustomers.id],
  }),
  author: one(businessMembers, {
    fields: [customerNotes.authorId],
    references: [businessMembers.id],
  }),
}));

// --- Customer Tags (Business-defined Categories) ---
export const customerTagsRelations = relations(customerTags, ({ one, many }) => ({
  business: one(businesses, {
    fields: [customerTags.businessId],
    references: [businesses.id],
  }),
  assignments: many(customerTagAssignments),
}));

// --- Customer Tag Assignments (The M:N Junction) ---
export const customerTagAssignmentsRelations = relations(customerTagAssignments, ({ one }) => ({
  business: one(businesses, {
    fields: [customerTagAssignments.businessId],
    references: [businesses.id],
  }),
  customer: one(businessCustomers, {
    fields: [customerTagAssignments.businessCustomerId],
    references: [businessCustomers.id],
  }),
  tag: one(customerTags, {
    fields: [customerTagAssignments.customerTagId],
    references: [customerTags.id],
  }),
  assignedBy: one(businessMembers, {
    fields: [customerTagAssignments.assignedBy],
    references: [businessMembers.id],
  }),
}));
