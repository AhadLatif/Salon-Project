import { relations } from 'drizzle-orm';
import { branches } from '../business/branches.js';
import { businesses } from '../business/businesses.js';
import { businessCustomers } from '../customer/business_customers.js';
import { users } from '../identity/users.js';
import { businessMembers } from '../RBAC/business_members.js';
import { services } from '../service/services.js';
import { staffMembers } from '../staff/staff_members.js';
import { appointmentNotes } from './appointment_notes.js';
import { appointmentServices } from './appointment_services.js';
import { appointmentStatusHistory } from './appointment_status_history.js';
import { appointments } from './appointments.js';

export const appointmentsRelations = relations(appointments, ({ one, many }) => ({
  business: one(businesses, { fields: [appointments.businessId], references: [businesses.id] }),
  branch: one(branches, { fields: [appointments.branchId], references: [branches.id] }),
  customer: one(businessCustomers, {
    fields: [appointments.businessCustomerId],
    references: [businessCustomers.id],
  }),

  // Explicitly named actors
  createdByUser: one(users, {
    fields: [appointments.createdByUserId],
    references: [users.id],
    relationName: 'createdByUser',
  }),
  createdByMember: one(businessMembers, {
    fields: [appointments.createdByBusinessMemberId],
    references: [businessMembers.id],
    relationName: 'createdByMember',
  }),
  cancelledByUser: one(users, {
    fields: [appointments.cancelledByUserId],
    references: [users.id],
    relationName: 'cancelledByUser',
  }),
  cancelledByMember: one(businessMembers, {
    fields: [appointments.cancelledByBusinessMemberId],
    references: [businessMembers.id],
    relationName: 'cancelledByMember',
  }),

  // Downstream children
  services: many(appointmentServices),
  statusHistory: many(appointmentStatusHistory),
  notes: many(appointmentNotes),
}));

export const appointmentServicesRelations = relations(appointmentServices, ({ one }) => ({
  business: one(businesses, {
    fields: [appointmentServices.businessId],
    references: [businesses.id],
  }),
  appointment: one(appointments, {
    fields: [appointmentServices.appointmentId],
    references: [appointments.id],
  }),
  service: one(services, { fields: [appointmentServices.serviceId], references: [services.id] }),
  staffMember: one(staffMembers, {
    fields: [appointmentServices.staffMemberId],
    references: [staffMembers.id],
  }),
}));

export const appointmentStatusHistoryRelations = relations(appointmentStatusHistory, ({ one }) => ({
  business: one(businesses, {
    fields: [appointmentStatusHistory.businessId],
    references: [businesses.id],
  }),
  appointment: one(appointments, {
    fields: [appointmentStatusHistory.appointmentId],
    references: [appointments.id],
  }),
  changedByMember: one(businessMembers, {
    fields: [appointmentStatusHistory.changedByBusinessMemberId],
    references: [businessMembers.id],
  }),
  changedByUser: one(users, {
    fields: [appointmentStatusHistory.changedByUserId],
    references: [users.id],
  }),
}));

export const appointmentNotesRelations = relations(appointmentNotes, ({ one }) => ({
  business: one(businesses, { fields: [appointmentNotes.businessId], references: [businesses.id] }),
  appointment: one(appointments, {
    fields: [appointmentNotes.appointmentId],
    references: [appointments.id],
  }),
  author: one(businessMembers, {
    fields: [appointmentNotes.authorId],
    references: [businessMembers.id],
  }),
}));
