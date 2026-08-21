import { describe, expect, it } from 'vitest';
import { createStaffMemberSchema } from '../src/api/dtos/create-staff-member.schema.js';
import { updateStaffMemberSchema } from '../src/api/dtos/update-staff-member.schema.js';

describe('Staff Member DTO Schema Date Validation Tests', () => {
  const validBaseCreate = {
    businessId: '01a02404-bc07-738b-9441-11e4b9ed0d32',
    businessMemberId: '01a02404-bc07-738b-9441-11e4b9ed0d33',
    displayName: 'John Doe',
  };

  describe('createStaffMemberSchema hireDate validation', () => {
    it('should accept valid calendar dates', () => {
      const validDates = ['2026-01-01', '2026-02-28', '2024-02-29', '2026-12-31'];
      for (const hireDate of validDates) {
        const result = createStaffMemberSchema.safeParse({
          ...validBaseCreate,
          hireDate,
        });
        expect(result.success).toBe(true);
      }
    });

    it('should allow null and undefined for hireDate', () => {
      const withNull = createStaffMemberSchema.safeParse({
        ...validBaseCreate,
        hireDate: null,
      });
      expect(withNull.success).toBe(true);

      const withUndefined = createStaffMemberSchema.safeParse({
        ...validBaseCreate,
        hireDate: undefined,
      });
      expect(withUndefined.success).toBe(true);
    });

    it('should reject invalid calendar dates and bad formats', () => {
      const invalidDates = [
        '2026-02-31', // Feb 31 does not exist
        '2025-02-29', // 2025 is not a leap year
        '2026-04-31', // April has 30 days
        '2026-13-01', // Month 13 does not exist
        '2026-00-10', // Month 0 does not exist
        '2026-05-32', // Day 32 does not exist
        '05-12-2026', // Wrong format
        '2026/05/12', // Wrong separator
        'not-a-date',
      ];

      for (const hireDate of invalidDates) {
        const result = createStaffMemberSchema.safeParse({
          ...validBaseCreate,
          hireDate,
        });
        expect(result.success).toBe(false);
      }
    });
  });

  describe('updateStaffMemberSchema hireDate validation', () => {
    it('should accept valid calendar dates and reject impossible dates', () => {
      const valid = updateStaffMemberSchema.safeParse({
        hireDate: '2026-08-21',
      });
      expect(valid.success).toBe(true);

      const invalidFeb31 = updateStaffMemberSchema.safeParse({
        hireDate: '2026-02-31',
      });
      expect(invalidFeb31.success).toBe(false);

      const nullable = updateStaffMemberSchema.safeParse({
        hireDate: null,
      });
      expect(nullable.success).toBe(true);
    });
  });
});
