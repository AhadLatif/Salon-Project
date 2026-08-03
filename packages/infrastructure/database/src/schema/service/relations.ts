import { relations } from 'drizzle-orm';
import { branches } from '../business/branches.js';
import { businesses } from '../business/businesses.js';
import { staffMembers } from '../staff/staff_members.js';
import { branchServices } from './branch_services.js';
import { serviceCategories } from './service_categories.js';
import { services } from './services.js';
import { staffServices } from './staff_services.js';

// --- Category Relations ---
export const serviceCategoriesRelations = relations(serviceCategories, ({ one, many }) => ({
  business: one(businesses, {
    fields: [serviceCategories.businessId],
    references: [businesses.id],
  }),
  // A category contains many services
  services: many(services),
}));

// --- Core Service Relations ---
export const servicesRelations = relations(services, ({ one, many }) => ({
  business: one(businesses, {
    fields: [services.businessId],
    references: [businesses.id],
  }),
  category: one(serviceCategories, {
    fields: [services.categoryId],
    references: [serviceCategories.id],
  }),
  // Downstream availability mappings
  staffServices: many(staffServices),
  branchServices: many(branchServices),
}));

// --- Staff Services (The Operational Junction) ---
export const staffServicesRelations = relations(staffServices, ({ one }) => ({
  business: one(businesses, {
    fields: [staffServices.businessId],
    references: [businesses.id],
  }),
  service: one(services, {
    fields: [staffServices.serviceId],
    references: [services.id],
  }),
  staffMember: one(staffMembers, {
    fields: [staffServices.staffMemberId],
    references: [staffMembers.id],
  }),
}));

// --- Branch Services (Location Availability) ---
export const branchServicesRelations = relations(branchServices, ({ one }) => ({
  business: one(businesses, {
    fields: [branchServices.businessId],
    references: [businesses.id],
  }),
  service: one(services, {
    fields: [branchServices.serviceId],
    references: [services.id],
  }),
  branch: one(branches, {
    fields: [branchServices.branchId],
    references: [branches.id],
  }),
}));
