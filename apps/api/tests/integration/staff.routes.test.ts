import { db } from '@salon/database';
import { truncateAllTables } from '@salon/testing';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';

describe('Staff Routes Integration Tests', () => {
  const app = createApp();
  let accessToken: string;
  let businessId: string;
  let businessMemberId: string;
  let anotherBusinessId: string;

  beforeEach(async () => {
    await truncateAllTables(db);

    // 1. Register a user and get tokens
    const registerResponse = await request(app).post('/api/v1/auth/register').send({
      firstName: 'Alice',
      lastName: 'Owner',
      email: 'alice.owner@example.com',
      password: 'SecurePassword123!',
    });
    accessToken = registerResponse.body.data.tokens.accessToken;
    const userId = registerResponse.body.data.user.id;

    // 2. Create a business (will auto-create a businessMember with Owner role)
    const businessResponse = await request(app)
      .post('/api/v1/businesses')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Alice Salon',
        slug: 'alice-salon',
        email: 'alice.business@example.com',
        phoneNumber: '+1234567890',
        countryCode: 'US',
        timezone: 'America/New_York',
        currency: 'USD',
      });

    businessId = businessResponse.body.data.business.id;

    // Fetch member via database since the /members route is not currently exposed
    const member = await db.query.businessMembers.findFirst({
      where: (members, { and, eq }) =>
        and(eq(members.businessId, businessId), eq(members.userId, userId)),
    });

    if (!member) {
      throw new Error('Business member not found for owner');
    }
    businessMemberId = member.id;

    // 3. Create Another Business to test Tenant Isolation
    const anotherBusinessResponse = await request(app)
      .post('/api/v1/businesses')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Another Salon',
        slug: 'another-salon',
        email: 'another@example.com',
        phoneNumber: '+1234567891',
        countryCode: 'US',
        timezone: 'America/New_York',
        currency: 'USD',
      });

    anotherBusinessId = anotherBusinessResponse.body.data.business.id;
  });

  it('should successfully create a staff member', async () => {
    const response = await request(app)
      .post(`/api/v1/businesses/${businessId}/staff`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-business-id', businessId)
      .send({
        businessMemberId,
        displayName: 'Alice Stylist',
        jobTitle: 'Senior Stylist',
        employmentType: 'full_time',
      });

    if (response.status !== 201) {
      console.log('RESPONSE:', JSON.stringify(response.body, null, 2));
    }
    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.staff.businessId).toBe(businessId);
    expect(response.body.data.staff.displayName).toBe('Alice Stylist');
  });

  it('should return 400 Validation Error for malformed UUIDs', async () => {
    const response = await request(app)
      .post(`/api/v1/businesses/${businessId}/staff`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-business-id', businessId)
      .send({
        businessMemberId: 'not-a-uuid',
        displayName: 'Invalid',
        employmentType: 'full_time',
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details.businessMemberId).toBeDefined();
  });

  it('should enforce Tenant Isolation (IDOR)', async () => {
    // Try to create a staff member in `anotherBusinessId` but passing the `x-business-id` header
    // pointing to `anotherBusinessId` with the `accessToken` belonging to the first user.
    // The validateTenantConsistency middleware will pass, but the token doesn't have access to this tenant.
    const response = await request(app)
      .post(`/api/v1/businesses/${anotherBusinessId}/staff`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-business-id', anotherBusinessId) // Matched tenant header vs url, but token lacks access
      .send({
        businessMemberId,
        displayName: 'Hacker',
        employmentType: 'full_time',
      });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('should run a complete staff schedule lifecycle', async () => {
    // 1. Create a staff member
    const staffResponse = await request(app)
      .post(`/api/v1/businesses/${businessId}/staff`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-business-id', businessId)
      .send({
        businessMemberId,
        displayName: 'Alice Stylist',
        employmentType: 'full_time',
      });

    const staffId = staffResponse.body.data.staff.id;

    // 2. Create a branch
    const branchResponse = await request(app)
      .post(`/api/v1/businesses/${businessId}/branches`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-business-id', businessId)
      .send({
        name: 'Downtown Branch',
        timezone: 'America/New_York',
        currency: 'USD',
        addressLine1: '123 Main St',
        city: 'New York',
        countryCode: 'US',
        openingHours: [{ dayOfWeek: 1, isClosed: false, opensAt: '09:00', closesAt: '17:00' }],
      });

    const branchId = branchResponse.body.data.branch.id;

    // 3. Assign Staff to Branch
    const assignResponse = await request(app)
      .post(`/api/v1/businesses/${businessId}/staff/${staffId}/branches`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-business-id', businessId)
      .send({
        branchId,
        isPrimary: true,
      });

    expect(assignResponse.status).toBe(201);
    expect(assignResponse.body.data.assignment.branchId).toBe(branchId);

    // 4. Create Work Schedule
    const scheduleResponse = await request(app)
      .post(`/api/v1/businesses/${businessId}/staff/${staffId}/schedules`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-business-id', businessId)
      .send({
        recurrencePattern: 'weekly',
        effectiveFrom: '2026-01-01',
      });

    expect(scheduleResponse.status).toBe(201);
    expect(scheduleResponse.body.data.schedule.recurrencePattern).toBe('weekly');
  });
});
