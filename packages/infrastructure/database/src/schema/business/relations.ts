import { relations } from 'drizzle-orm';
import { branches } from './branches.js';
import { businessSettings } from './business_settings.js';
import { businesses } from './businesses.js';
import { openingHours } from './opening_hours.js';

export const businessesRelations = relations(businesses, ({ one, many }) => ({
  branches: many(branches),
  openingHours: many(openingHours),
  settings: one(businessSettings, {
    fields: [businesses.id],
    references: [businessSettings.businessId],
  }),
}));

export const branchesRelations = relations(branches, ({ one, many }) => ({
  business: one(businesses, {
    fields: [branches.businessId],
    references: [businesses.id],
  }),
  openingHours: many(openingHours),
}));

export const openingHoursRelations = relations(openingHours, ({ one }) => ({
  branch: one(branches, {
    fields: [openingHours.branchId],
    references: [branches.id],
  }),
  business: one(businesses, {
    fields: [openingHours.businessId],
    references: [businesses.id],
  }),
}));
