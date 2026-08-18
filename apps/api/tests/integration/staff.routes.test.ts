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
      .set('x-branch-id', branchId)
      .send({
        branchId,
        recurrencePattern: 'weekly',
        effectiveFrom: '2026-01-01',
      });

    expect(scheduleResponse.status).toBe(201);
    expect(scheduleResponse.body.data.schedule.recurrencePattern).toBe('weekly');
    expect(scheduleResponse.body.data.schedule.branchId).toBe(branchId);
  });

  it('should reject schedule creation when branchId in body mismatches x-branch-id header', async () => {
    // 1. Create a staff member
    const staffResponse = await request(app)
      .post(`/api/v1/businesses/${businessId}/staff`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-business-id', businessId)
      .send({
        businessMemberId,
        displayName: 'Alice Stylist 2',
        employmentType: 'full_time',
      });

    const staffId = staffResponse.body.data.staff.id;

    // 2. Create branch 1
    const branch1Response = await request(app)
      .post(`/api/v1/businesses/${businessId}/branches`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-business-id', businessId)
      .send({
        name: 'Downtown Branch 1',
        timezone: 'America/New_York',
        currency: 'USD',
        addressLine1: '123 Main St',
        city: 'New York',
        countryCode: 'US',
        openingHours: [{ dayOfWeek: 1, isClosed: false, opensAt: '09:00', closesAt: '17:00' }],
      });

    const branch1Id = branch1Response.body.data.branch.id;

    // 3. Create branch 2
    const branch2Response = await request(app)
      .post(`/api/v1/businesses/${businessId}/branches`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-business-id', businessId)
      .send({
        name: 'Downtown Branch 2',
        timezone: 'America/New_York',
        currency: 'USD',
        addressLine1: '123 Main St',
        city: 'New York',
        countryCode: 'US',
        openingHours: [{ dayOfWeek: 1, isClosed: false, opensAt: '09:00', closesAt: '17:00' }],
      });

    const branch2Id = branch2Response.body.data.branch.id;

    await request(app)
      .post(`/api/v1/businesses/${businessId}/staff/${staffId}/branches`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-business-id', businessId)
      .send({
        branchId: branch1Id,
        isPrimary: true,
      });

    // 4. Create Work Schedule with mismatched branch
    const scheduleResponse = await request(app)
      .post(`/api/v1/businesses/${businessId}/staff/${staffId}/schedules`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-business-id', businessId)
      .set('x-branch-id', branch1Id) // Header says branch1
      .send({
        branchId: branch2Id, // Body says branch2
        recurrencePattern: 'weekly',
        effectiveFrom: '2026-01-01',
      });

    expect(scheduleResponse.status).toBe(403);
    expect(scheduleResponse.body.error.code).toBe('FORBIDDEN');
    expect(scheduleResponse.body.error.message).toBe(
      'Requested branch ID does not match the authorized branch context.',
    );
  });

  it('should deny cross-branch reads and writes for schedules and shifts', async () => {
    // 1. Create a staff member
    const staffResponse = await request(app)
      .post(`/api/v1/businesses/${businessId}/staff`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-business-id', businessId)
      .send({
        businessMemberId,
        displayName: 'Bob Stylist',
        employmentType: 'full_time',
      });
    const staffId = staffResponse.body.data.staff.id;

    // 2. Create branch A
    const branchAResponse = await request(app)
      .post(`/api/v1/businesses/${businessId}/branches`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-business-id', businessId)
      .send({
        name: 'Branch A',
        timezone: 'America/New_York',
        currency: 'USD',
        addressLine1: '123 Main St',
        city: 'New York',
        countryCode: 'US',
        openingHours: [{ dayOfWeek: 1, isClosed: false, opensAt: '09:00', closesAt: '17:00' }],
      });
    const branchAId = branchAResponse.body.data.branch.id;

    // 3. Create branch B
    const branchBResponse = await request(app)
      .post(`/api/v1/businesses/${businessId}/branches`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-business-id', businessId)
      .send({
        name: 'Branch B',
        timezone: 'America/New_York',
        currency: 'USD',
        addressLine1: '456 Other St',
        city: 'New York',
        countryCode: 'US',
        openingHours: [{ dayOfWeek: 1, isClosed: false, opensAt: '09:00', closesAt: '17:00' }],
      });
    const branchBId = branchBResponse.body.data.branch.id;

    // Assign to Branch A
    await request(app)
      .post(`/api/v1/businesses/${businessId}/staff/${staffId}/branches`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-business-id', businessId)
      .send({
        branchId: branchAId,
        isPrimary: true,
      });

    // Create schedule in Branch A
    const scheduleResponse = await request(app)
      .post(`/api/v1/businesses/${businessId}/staff/${staffId}/schedules`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-business-id', businessId)
      .set('x-branch-id', branchAId)
      .send({
        branchId: branchAId,
        recurrencePattern: 'weekly',
        effectiveFrom: '2026-01-01',
      });
    const scheduleId = scheduleResponse.body.data.schedule.id;

    // Try to read schedules from Branch A - should succeed
    const readA = await request(app)
      .get(`/api/v1/businesses/${businessId}/staff/${staffId}/schedules`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-business-id', businessId)
      .set('x-branch-id', branchAId);
    expect(readA.status).toBe(200);
    expect(readA.body.data.schedules).toHaveLength(1);

    // Try to read schedules from Branch B - should return empty list
    const readB = await request(app)
      .get(`/api/v1/businesses/${businessId}/staff/${staffId}/schedules`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-business-id', businessId)
      .set('x-branch-id', branchBId);
    expect(readB.status).toBe(200);
    expect(readB.body.data.schedules).toHaveLength(0); // Branch A schedule should not appear

    // Try to add shift to Branch A's schedule while in Branch B context
    const shiftB = await request(app)
      .post(`/api/v1/businesses/${businessId}/staff/${staffId}/schedules/${scheduleId}/shifts`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-business-id', businessId)
      .set('x-branch-id', branchBId)
      .send({
        dayOfWeek: 1,
        startsAt: '09:00',
        endsAt: '17:00',
      });

    expect(shiftB.status).toBe(403);
    expect(shiftB.body.error.code).toBe('FORBIDDEN');
  });
});
