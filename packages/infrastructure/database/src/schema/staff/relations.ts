import { relations } from 'drizzle-orm';
import { branches } from '../business/branches.js';
import { businesses } from '../business/businesses.js';
import { businessMembers } from '../RBAC/business_members.js';
import { staffBranchAssignments } from './staff_branch_assignments.js';
import { staffMembers } from './staff_members.js';
import { staffScheduleShifts } from './staff_schedule_shifts.js';
import { staffTimeOff } from './staff_time_off.js';
import { staffWorkSchedules } from './staff_work_schedules.js';

export const staffMembersRelations = relations(staffMembers, ({ one, many }) => ({
  // Links to the tenant and the canonical business member profile
  business: one(businesses, {
    fields: [staffMembers.businessId],
    references: [businesses.id],
  }),
  businessMember: one(businessMembers, {
    fields: [staffMembers.businessMemberId],
    references: [businessMembers.id],
  }),
  // Downstream relationships
  branchAssignments: many(staffBranchAssignments),
  workSchedules: many(staffWorkSchedules),
  timeOff: many(staffTimeOff),
}));

export const staffBranchAssignmentsRelations = relations(staffBranchAssignments, ({ one }) => ({
  staffMember: one(staffMembers, {
    fields: [staffBranchAssignments.staffMemberId],
    references: [staffMembers.id],
  }),
  branch: one(branches, {
    fields: [staffBranchAssignments.branchId],
    references: [branches.id],
  }),
  business: one(businesses, {
    fields: [staffBranchAssignments.businessId],
    references: [businesses.id],
  }),
}));

export const staffWorkSchedulesRelations = relations(staffWorkSchedules, ({ one, many }) => ({
  staffMember: one(staffMembers, {
    fields: [staffWorkSchedules.staffMemberId],
    references: [staffMembers.id],
  }),
  business: one(businesses, {
    fields: [staffWorkSchedules.businessId],
    references: [businesses.id],
  }),
  // A schedule has many daily shifts
  shifts: many(staffScheduleShifts),
}));

export const staffScheduleShiftsRelations = relations(staffScheduleShifts, ({ one }) => ({
  schedule: one(staffWorkSchedules, {
    fields: [staffScheduleShifts.workScheduleId],
    references: [staffWorkSchedules.id],
  }),
}));

export const staffTimeOffRelations = relations(staffTimeOff, ({ one }) => ({
  staffMember: one(staffMembers, {
    fields: [staffTimeOff.staffMemberId],
    references: [staffMembers.id],
  }),
  business: one(businesses, {
    fields: [staffTimeOff.businessId],
    references: [businesses.id],
  }),
  // The manager/owner who approved the time off
  approvedBy: one(businessMembers, {
    fields: [staffTimeOff.approvedBy],
    references: [businessMembers.id],
  }),
}));
