import { relations } from 'drizzle-orm';
import { appointments } from '../appointment/appointments.js';
import { businesses } from '../business/businesses.js';
import { businessCustomers } from '../customer/business_customers.js';
import { businessMembers } from '../RBAC/business_members.js';
import { reviewResponses } from './review_responses.js';
import { reviews } from './reviews.js';

// --- Reviews ---
export const reviewsRelations = relations(reviews, ({ one }) => ({
  business: one(businesses, {
    fields: [reviews.businessId],
    references: [businesses.id],
  }),
  appointment: one(appointments, {
    fields: [reviews.appointmentId],
    references: [appointments.id],
  }),
  customer: one(businessCustomers, {
    fields: [reviews.businessCustomerId],
    references: [businessCustomers.id],
  }),
  // A review has at most one response
  response: one(reviewResponses, {
    fields: [reviews.id],
    references: [reviewResponses.reviewId],
  }),
}));

// --- Review Responses ---
export const reviewResponsesRelations = relations(reviewResponses, ({ one }) => ({
  business: one(businesses, {
    fields: [reviewResponses.businessId],
    references: [businesses.id],
  }),
  review: one(reviews, {
    fields: [reviewResponses.reviewId],
    references: [reviews.id],
  }),
  // The team member who wrote the reply
  author: one(businessMembers, {
    fields: [reviewResponses.businessMemberId],
    references: [businessMembers.id],
  }),
}));
