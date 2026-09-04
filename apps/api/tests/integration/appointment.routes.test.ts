import { db, staffScheduleShifts, staffWorkSchedules } from '@salon/database';
import { truncateAllTables } from '@salon/testing';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';

describe('Appointment API Routes Integration Tests', () => {
  const app = createApp();
  let accessToken: string;
  let businessId: string;
  let branchId: string;
  let customerId: string;
  let serviceId: string;
  let staffMemberId: string;

  beforeEach(async () => {
    await truncateAllTables(db);

    // 1. Register owner user
    const registerResponse = await request(app).post('/api/v1/auth/register').send({
      firstName: 'Owner',
      lastName: 'User',
      email: 'owner@example.com',
      password: 'SecurePassword123!',
    });
    const userId = registerResponse.body.data.user.id;
    accessToken = registerResponse.body.data.tokens.accessToken;

    // 2. Create business
    const businessResponse = await request(app)
      .post('/api/v1/businesses')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Appointment Test Salon',
        slug: 'appointment-salon',
        email: 'salon@example.com',
        phoneNumber: '+1234567890',
        countryCode: 'US',
        timezone: 'UTC',
        currency: 'USD',
      });
    businessId = businessResponse.body.data.business.id;

    // 3. Create branch with opening hours
    const branchResponse = await request(app)
      .post(`/api/v1/businesses/${businessId}/branches`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-business-id', businessId)
      .send({
        name: 'Main Branch',
        timezone: 'UTC',
        currency: 'USD',
        addressLine1: '123 Main St',
        city: 'New York',
        countryCode: 'US',
        openingHours: [
          { dayOfWeek: 1, isClosed: false, opensAt: '08:00', closesAt: '20:00' },
          { dayOfWeek: 2, isClosed: false, opensAt: '08:00', closesAt: '20:00' },
          { dayOfWeek: 3, isClosed: false, opensAt: '08:00', closesAt: '20:00' },
          { dayOfWeek: 4, isClosed: false, opensAt: '08:00', closesAt: '20:00' },
          { dayOfWeek: 5, isClosed: false, opensAt: '08:00', closesAt: '20:00' },
        ],
      });
    branchId = branchResponse.body.data.branch.id;

    // 4. Create customer
    const customerResponse = await request(app)
      .post(`/api/v1/businesses/${businessId}/customers`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-business-id', businessId)
      .send({
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane.doe@example.com',
        phoneNumber: '+14155552671',
      });
    customerId = customerResponse.body.data.customer.id;

    // 5. Create service category and service
    const categoryResponse = await request(app)
      .post(`/api/v1/businesses/${businessId}/service-categories`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-business-id', businessId)
      .send({ name: 'Hair Services' });
    const categoryId = categoryResponse.body.data.category.id;

    const serviceResponse = await request(app)
      .post(`/api/v1/businesses/${businessId}/services`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-business-id', businessId)
      .send({
        categoryId,
        name: 'Haircut & Styling',
        defaultPrice: '60.00',
        defaultDurationMinutes: 60,
      });
    serviceId = serviceResponse.body.data.service.id;

    // Assign service to branch
    await request(app)
      .post(`/api/v1/businesses/${businessId}/services/${serviceId}/branches`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-business-id', businessId)
      .send({ branchId });

    // 6. Create staff member using the owner's auto-bootstrapped business member
    const member = await db.query.businessMembers.findFirst({
      where: (members, { and, eq }) =>
        and(eq(members.businessId, businessId), eq(members.userId, userId)),
    });
    if (!member) {
      throw new Error('Business member not found for owner');
    }

    const staffResponse = await request(app)
      .post(`/api/v1/businesses/${businessId}/staff`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-business-id', businessId)
      .send({
        businessMemberId: member.id,
        displayName: 'Sarah Stylist',
        jobTitle: 'Senior Stylist',
        employmentType: 'full_time',
      });
    staffMemberId = staffResponse.body.data.staff.id;

    // Assign staff member to branch
    await request(app)
      .post(`/api/v1/businesses/${businessId}/staff/${staffMemberId}/branches`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-business-id', businessId)
      .send({ branchId });

    // Assign service to staff member
    await request(app)
      .post(`/api/v1/businesses/${businessId}/staff/${staffMemberId}/services`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-business-id', businessId)
      .send({ serviceId });
  });

  describe('POST /api/v1/businesses/:businessId/appointments', () => {
    it('successfully books an appointment and creates allocations', async () => {
      const scheduledStartAt = '2030-06-15T10:00:00.000Z';

      const response = await request(app)
        .post(`/api/v1/businesses/${businessId}/appointments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId)
        .set('x-branch-id', branchId)
        .send({
          branchId,
          businessCustomerId: customerId,
          scheduledStartAt,
          bookingChannel: 'business_dashboard',
          segments: [
            {
              serviceId,
              staffMemberId,
              notes: 'Client requested gentle shampoo',
            },
          ],
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.appointment).toBeDefined();
      expect(response.body.data.appointment.businessId).toBe(businessId);
      expect(response.body.data.appointment.status).toBe('confirmed');
      expect(response.body.data.appointment.segments).toHaveLength(1);
      expect(response.body.data.appointment.segments[0].serviceName).toBe('Haircut & Styling');
      expect(response.body.data.appointment.segments[0].staffName).toBe('Sarah Stylist');
    });

    it('rejects concurrent double-booking with 409 Conflict', async () => {
      const scheduledStartAt = '2030-06-15T14:00:00.000Z';

      // First booking succeeds
      const firstRes = await request(app)
        .post(`/api/v1/businesses/${businessId}/appointments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId)
        .set('x-branch-id', branchId)
        .send({
          branchId,
          businessCustomerId: customerId,
          scheduledStartAt,
          bookingChannel: 'business_dashboard',
          segments: [{ serviceId, staffMemberId }],
        });
      expect(firstRes.status).toBe(201);

      // Second booking for the same staff member overlapping in time returns 409 Conflict
      const secondRes = await request(app)
        .post(`/api/v1/businesses/${businessId}/appointments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId)
        .set('x-branch-id', branchId)
        .send({
          branchId,
          businessCustomerId: customerId,
          scheduledStartAt,
          bookingChannel: 'business_dashboard',
          segments: [{ serviceId, staffMemberId }],
        });

      expect(secondRes.status).toBe(409);
      expect(secondRes.body.success).toBe(false);
      expect(secondRes.body.error.code).toBe('CONFLICT');
    });

    it('denies access when x-business-id header is missing (IDOR protection)', async () => {
      const response = await request(app)
        .post(`/api/v1/businesses/${businessId}/appointments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          branchId,
          businessCustomerId: customerId,
          scheduledStartAt: '2030-06-15T16:00:00.000Z',
          bookingChannel: 'business_dashboard',
          segments: [{ serviceId, staffMemberId }],
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/businesses/:businessId/appointments/:appointmentId', () => {
    it('retrieves appointment details by ID', async () => {
      const createRes = await request(app)
        .post(`/api/v1/businesses/${businessId}/appointments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId)
        .set('x-branch-id', branchId)
        .send({
          branchId,
          businessCustomerId: customerId,
          scheduledStartAt: '2030-07-01T10:00:00.000Z',
          bookingChannel: 'business_dashboard',
          segments: [{ serviceId, staffMemberId }],
        });

      const appointmentId = createRes.body.data.appointment.id;

      const getRes = await request(app)
        .get(`/api/v1/businesses/${businessId}/appointments/${appointmentId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId);

      expect(getRes.status).toBe(200);
      expect(getRes.body.success).toBe(true);
      expect(getRes.body.data.appointment.id).toBe(appointmentId);
      expect(getRes.body.data.appointment.segments).toHaveLength(1);
    });

    it('returns 404 for non-existent appointment ID', async () => {
      const getRes = await request(app)
        .get(`/api/v1/businesses/${businessId}/appointments/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId);

      expect(getRes.status).toBe(404);
      expect(getRes.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/businesses/:businessId/appointments', () => {
    it('lists appointments with filters and pagination', async () => {
      // Create two bookings
      await request(app)
        .post(`/api/v1/businesses/${businessId}/appointments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId)
        .set('x-branch-id', branchId)
        .send({
          branchId,
          businessCustomerId: customerId,
          scheduledStartAt: '2030-08-01T10:00:00.000Z',
          bookingChannel: 'business_dashboard',
          segments: [{ serviceId, staffMemberId }],
        });

      await request(app)
        .post(`/api/v1/businesses/${businessId}/appointments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId)
        .set('x-branch-id', branchId)
        .send({
          branchId,
          businessCustomerId: customerId,
          scheduledStartAt: '2030-08-01T12:00:00.000Z',
          bookingChannel: 'business_dashboard',
          segments: [{ serviceId, staffMemberId }],
        });

      const listRes = await request(app)
        .get(`/api/v1/businesses/${businessId}/appointments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId)
        .query({ branchId, status: 'confirmed', limit: 10 });

      expect(listRes.status).toBe(200);
      expect(listRes.body.success).toBe(true);
      expect(listRes.body.data.appointments).toHaveLength(2);
      expect(listRes.body.meta.total).toBe(2);
    });
  });

  describe('POST /api/v1/businesses/:businessId/appointments/:appointmentId/status', () => {
    it('progresses appointment through confirmed -> checked_in -> in_progress -> completed lifecycle', async () => {
      const createRes = await request(app)
        .post(`/api/v1/businesses/${businessId}/appointments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId)
        .set('x-branch-id', branchId)
        .send({
          branchId,
          businessCustomerId: customerId,
          scheduledStartAt: '2030-09-01T10:00:00.000Z',
          bookingChannel: 'business_dashboard',
          segments: [{ serviceId, staffMemberId }],
        });
      const appointmentId = createRes.body.data.appointment.id;

      // 1. confirmed -> checked_in
      const checkInRes = await request(app)
        .post(`/api/v1/businesses/${businessId}/appointments/${appointmentId}/status`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId)
        .send({ status: 'checked_in', reason: 'Customer arrived' });
      expect(checkInRes.status).toBe(200);
      expect(checkInRes.body.data.appointment.status).toBe('checked_in');

      // 2. checked_in -> in_progress
      const startRes = await request(app)
        .post(`/api/v1/businesses/${businessId}/appointments/${appointmentId}/status`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId)
        .send({ status: 'in_progress', reason: 'Service started' });
      expect(startRes.status).toBe(200);
      expect(startRes.body.data.appointment.status).toBe('in_progress');

      // 3. in_progress -> completed (frees allocations!)
      const completeRes = await request(app)
        .post(`/api/v1/businesses/${businessId}/appointments/${appointmentId}/status`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId)
        .send({ status: 'completed', reason: 'Service completed' });
      expect(completeRes.status).toBe(200);
      expect(completeRes.body.data.appointment.status).toBe('completed');

      // 4. Invalid transition from completed (terminal) fails with 409 Conflict
      const invalidRes = await request(app)
        .post(`/api/v1/businesses/${businessId}/appointments/${appointmentId}/status`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId)
        .send({ status: 'confirmed' });
      expect(invalidRes.status).toBe(409);
      expect(invalidRes.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/businesses/:businessId/appointments/:appointmentId/cancel', () => {
    it('cancels appointment and frees occupied slot so another customer can book it', async () => {
      const slotTime = '2030-10-01T15:00:00.000Z';

      // 1. First booking takes the slot
      const createRes = await request(app)
        .post(`/api/v1/businesses/${businessId}/appointments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId)
        .set('x-branch-id', branchId)
        .send({
          branchId,
          businessCustomerId: customerId,
          scheduledStartAt: slotTime,
          bookingChannel: 'business_dashboard',
          segments: [{ serviceId, staffMemberId }],
        });
      expect(createRes.status).toBe(201);
      const appointmentId = createRes.body.data.appointment.id;

      // Double-booking check: slot is currently occupied
      const conflictRes = await request(app)
        .post(`/api/v1/businesses/${businessId}/appointments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId)
        .set('x-branch-id', branchId)
        .send({
          branchId,
          businessCustomerId: customerId,
          scheduledStartAt: slotTime,
          bookingChannel: 'business_dashboard',
          segments: [{ serviceId, staffMemberId }],
        });
      expect(conflictRes.status).toBe(409);

      // 2. Cancel the appointment
      const cancelRes = await request(app)
        .post(`/api/v1/businesses/${businessId}/appointments/${appointmentId}/cancel`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId)
        .send({ cancellationReason: 'Client called to cancel due to emergency' });

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.appointment.status).toBe('cancelled');
      expect(cancelRes.body.data.appointment.cancellationReason).toBe(
        'Client called to cancel due to emergency',
      );

      // 3. Now the SAME slot can be booked again by a new appointment!
      const rebookRes = await request(app)
        .post(`/api/v1/businesses/${businessId}/appointments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId)
        .set('x-branch-id', branchId)
        .send({
          branchId,
          businessCustomerId: customerId,
          scheduledStartAt: slotTime,
          bookingChannel: 'business_dashboard',
          segments: [{ serviceId, staffMemberId }],
        });

      expect(rebookRes.status).toBe(201);
      expect(rebookRes.body.success).toBe(true);
      expect(rebookRes.body.data.appointment.status).toBe('confirmed');
    });
  });

  describe('POST /api/v1/businesses/:businessId/appointments/:appointmentId/reschedule', () => {
    it('successfully reschedules an appointment to an open slot', async () => {
      // 1. Initial booking at 10:00
      const initialRes = await request(app)
        .post(`/api/v1/businesses/${businessId}/appointments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId)
        .set('x-branch-id', branchId)
        .send({
          branchId,
          businessCustomerId: customerId,
          scheduledStartAt: '2030-11-01T10:00:00.000Z',
          bookingChannel: 'business_dashboard',
          segments: [{ serviceId, staffMemberId }],
        });
      expect(initialRes.status).toBe(201);
      const appointmentId = initialRes.body.data.appointment.id;

      // 2. Reschedule to 14:00
      const newTime = '2030-11-01T14:00:00.000Z';
      const rescheduleRes = await request(app)
        .post(`/api/v1/businesses/${businessId}/appointments/${appointmentId}/reschedule`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId)
        .send({
          scheduledStartAt: newTime,
          reason: 'Client requested afternoon slot',
        });

      expect(rescheduleRes.status).toBe(200);
      expect(rescheduleRes.body.success).toBe(true);
      expect(new Date(rescheduleRes.body.data.appointment.scheduledStartAt).toISOString()).toBe(
        newTime,
      );

      // 3. Old slot (10:00) is now free for someone else!
      const rebookOldSlotRes = await request(app)
        .post(`/api/v1/businesses/${businessId}/appointments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId)
        .set('x-branch-id', branchId)
        .send({
          branchId,
          businessCustomerId: customerId,
          scheduledStartAt: '2030-11-01T10:00:00.000Z',
          bookingChannel: 'business_dashboard',
          segments: [{ serviceId, staffMemberId }],
        });
      expect(rebookOldSlotRes.status).toBe(201);
    });

    it('rejects rescheduling into an already occupied slot with 409 Conflict', async () => {
      // 1. Booking A at 09:00
      const apptARes = await request(app)
        .post(`/api/v1/businesses/${businessId}/appointments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId)
        .set('x-branch-id', branchId)
        .send({
          branchId,
          businessCustomerId: customerId,
          scheduledStartAt: '2030-11-02T09:00:00.000Z',
          bookingChannel: 'business_dashboard',
          segments: [{ serviceId, staffMemberId }],
        });
      const apptAId = apptARes.body.data.appointment.id;

      // 2. Booking B at 11:00
      await request(app)
        .post(`/api/v1/businesses/${businessId}/appointments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId)
        .set('x-branch-id', branchId)
        .send({
          branchId,
          businessCustomerId: customerId,
          scheduledStartAt: '2030-11-02T11:00:00.000Z',
          bookingChannel: 'business_dashboard',
          segments: [{ serviceId, staffMemberId }],
        });

      // 3. Try to reschedule Booking A into 11:00 (overlapping with B) -> 409 Conflict!
      const conflictRes = await request(app)
        .post(`/api/v1/businesses/${businessId}/appointments/${apptAId}/reschedule`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId)
        .send({
          scheduledStartAt: '2030-11-02T11:00:00.000Z',
          reason: 'Attempt conflict',
        });

      expect(conflictRes.status).toBe(409);
      expect(conflictRes.body.success).toBe(false);
      expect(conflictRes.body.error.code).toBe('CONFLICT');

      // 4. Booking A remains at 09:00 unchanged
      const detailRes = await request(app)
        .get(`/api/v1/businesses/${businessId}/appointments/${apptAId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId);
      expect(new Date(detailRes.body.data.appointment.scheduledStartAt).toISOString()).toBe(
        '2030-11-02T09:00:00.000Z',
      );
    });

    it('rejects rescheduling a cancelled appointment with 409 Conflict', async () => {
      const apptRes = await request(app)
        .post(`/api/v1/businesses/${businessId}/appointments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId)
        .set('x-branch-id', branchId)
        .send({
          branchId,
          businessCustomerId: customerId,
          scheduledStartAt: '2030-11-03T10:00:00.000Z',
          bookingChannel: 'business_dashboard',
          segments: [{ serviceId, staffMemberId }],
        });
      const apptId = apptRes.body.data.appointment.id;

      // Cancel it
      await request(app)
        .post(`/api/v1/businesses/${businessId}/appointments/${apptId}/cancel`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId)
        .send({});

      // Attempt reschedule -> 409 Conflict
      const res = await request(app)
        .post(`/api/v1/businesses/${businessId}/appointments/${apptId}/reschedule`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId)
        .send({
          scheduledStartAt: '2030-11-03T14:00:00.000Z',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('successfully reschedules a multi-service appointment with buffers and derives correct sequential timings', async () => {
      // 1. Setup a second service (15 min + 10 min bufferAfter)
      const catRes = await request(app)
        .get(`/api/v1/businesses/${businessId}/service-categories`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId);
      const catId = catRes.body.data.categories[0].id;

      const svc2Res = await request(app)
        .post(`/api/v1/businesses/${businessId}/services`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId)
        .send({
          categoryId: catId,
          name: 'Quick Trim',
          defaultPrice: '20.00',
          defaultDurationMinutes: 15,
          bufferBeforeMinutes: 0,
          bufferAfterMinutes: 10,
        });
      const service2Id = svc2Res.body.data.service.id;

      await request(app)
        .post(`/api/v1/businesses/${businessId}/services/${service2Id}/branches`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId)
        .send({ branchId });

      await request(app)
        .post(`/api/v1/businesses/${businessId}/staff/${staffMemberId}/services`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId)
        .send({ serviceId: service2Id });

      // 2. Initial Booking: 10:00 AM.
      // S1: 60m + 10m buffer after = 10:00 - 11:10 occupied (end 11:00)
      // S2: 15m + 10m buffer after = 11:10 - 11:35 occupied (starts 11:10, end 11:25)
      const initialRes = await request(app)
        .post(`/api/v1/businesses/${businessId}/appointments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId)
        .set('x-branch-id', branchId)
        .send({
          branchId,
          businessCustomerId: customerId,
          scheduledStartAt: '2030-11-04T10:00:00.000Z',
          bookingChannel: 'business_dashboard',
          segments: [
            { serviceId, staffMemberId },
            { serviceId: service2Id, staffMemberId },
          ],
        });
      expect(initialRes.status).toBe(201);
      const appointmentId = initialRes.body.data.appointment.id;

      // 3. Reschedule to 14:00 PM
      const reschedRes = await request(app)
        .post(`/api/v1/businesses/${businessId}/appointments/${appointmentId}/reschedule`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId)
        .send({
          scheduledStartAt: '2030-11-04T14:00:00.000Z',
        });

      expect(reschedRes.status).toBe(200);
      expect(reschedRes.body.data.appointment.segments).toHaveLength(2);

      // S1 start should be 14:00, S2 start should be 15:00
      expect(new Date(reschedRes.body.data.appointment.segments[0].startsAt).toISOString()).toBe(
        '2030-11-04T14:00:00.000Z',
      );
      expect(new Date(reschedRes.body.data.appointment.segments[1].startsAt).toISOString()).toBe(
        '2030-11-04T15:00:00.000Z',
      );
      expect(new Date(reschedRes.body.data.appointment.scheduledEndAt).toISOString()).toBe(
        '2030-11-04T15:15:00.000Z',
      );
    });
  });

  describe('GET /api/v1/businesses/:businessId/appointments/availability', () => {
    it('computes available slots and removes slots occupied by bookings', async () => {
      // 2030-12-04 is a Wednesday -> dayOfWeek = 3 (opening hours 08:00 - 20:00 already seeded in beforeEach)
      // 1. Seed Staff Work Schedule & Shift: Wednesday 09:00 - 17:00
      const [schedule] = await db
        .insert(staffWorkSchedules)
        .values({
          businessId,
          staffMemberId,
          branchId,
          recurrencePattern: 'weekly',
          effectiveFrom: '2030-01-01',
        })
        .returning();

      await db.insert(staffScheduleShifts).values({
        // biome-ignore lint/style/noNonNullAssertion: test setup guaranteed to return row
        workScheduleId: schedule!.id,
        dayOfWeek: 3,
        startsAt: '09:00:00',
        endsAt: '17:00:00',
      });

      // 3. Query availability before any bookings
      const initialRes = await request(app)
        .get(`/api/v1/businesses/${businessId}/appointments/availability`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId)
        .query({
          branchId,
          serviceId,
          date: '2030-12-04',
          staffMemberId,
        });

      expect(initialRes.status).toBe(200);
      expect(initialRes.body.success).toBe(true);
      const initialSlots: Array<{ startsAt: string }> = initialRes.body.data.slots;
      expect(initialSlots.length).toBeGreaterThan(0);
      // Contains 10:00 slot
      expect(initialSlots.some((s) => s.startsAt.includes('10:00:00'))).toBe(true);

      // 4. Book an appointment at 10:00 (Haircut: 60 min + buffers)
      const bookRes = await request(app)
        .post(`/api/v1/businesses/${businessId}/appointments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId)
        .set('x-branch-id', branchId)
        .send({
          branchId,
          businessCustomerId: customerId,
          scheduledStartAt: '2030-12-04T10:00:00.000Z',
          bookingChannel: 'business_dashboard',
          segments: [{ serviceId, staffMemberId }],
        });
      expect(bookRes.status).toBe(201);

      // 5. Re-query availability
      const afterRes = await request(app)
        .get(`/api/v1/businesses/${businessId}/appointments/availability`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId)
        .query({
          branchId,
          serviceId,
          date: '2030-12-04',
          staffMemberId,
        });

      expect(afterRes.status).toBe(200);
      const afterSlots: Array<{ startsAt: string }> = afterRes.body.data.slots;
      // 10:00 slot is no longer available!
      expect(afterSlots.some((s) => s.startsAt.includes('10:00:00'))).toBe(false);
      // Other slots remain available (e.g. 09:00, 14:00)
      expect(afterSlots.some((s) => s.startsAt.includes('09:00:00'))).toBe(true);
      expect(afterSlots.some((s) => s.startsAt.includes('14:00:00'))).toBe(true);
    });
  });

  describe('Security Review & Advanced Edge Cases', () => {
    let businessBId: string;
    let businessBToken: string;
    let businessBBranchId: string;

    beforeEach(async () => {
      // Create a completely separate business B with a separate owner
      const regB = await request(app).post('/api/v1/auth/register').send({
        firstName: 'Attacker',
        lastName: 'User',
        email: 'attacker@example.com',
        password: 'SecurePassword123!',
      });
      businessBToken = regB.body.data.tokens.accessToken;

      const bizB = await request(app)
        .post('/api/v1/businesses')
        .set('Authorization', `Bearer ${businessBToken}`)
        .send({
          name: 'Attacker Business',
          slug: 'attacker-business',
          email: 'attacker@example.com',
          phoneNumber: '+1999999999',
          countryCode: 'US',
          timezone: 'UTC',
          currency: 'USD',
        });
      businessBId = bizB.body.data.business.id;

      const branchBRes = await request(app)
        .post(`/api/v1/businesses/${businessBId}/branches`)
        .set('Authorization', `Bearer ${businessBToken}`)
        .set('x-business-id', businessBId)
        .send({
          name: 'Attacker Branch',
          timezone: 'UTC',
          currency: 'USD',
          addressLine1: '456 Attacker St',
          city: 'New York',
          countryCode: 'US',
          openingHours: [{ dayOfWeek: 1, isClosed: false, opensAt: '08:00', closesAt: '20:00' }],
        });
      businessBBranchId = branchBRes.body.data.branch.id;
    });

    it('IDOR: prevents Business B from reading, cancelling, status-modifying, or rescheduling Business A appointment', async () => {
      // 1. Create an appointment in Business A
      const createRes = await request(app)
        .post(`/api/v1/businesses/${businessId}/appointments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId)
        .set('x-branch-id', branchId)
        .send({
          branchId,
          businessCustomerId: customerId,
          scheduledStartAt: '2030-12-10T10:00:00.000Z',
          bookingChannel: 'business_dashboard',
          segments: [{ serviceId, staffMemberId }],
        });
      expect(createRes.status).toBe(201);
      const apptAId = createRes.body.data.appointment.id;

      // 2. Business B tries to GET Business A's appointment -> 404
      const getRes = await request(app)
        .get(`/api/v1/businesses/${businessBId}/appointments/${apptAId}`)
        .set('Authorization', `Bearer ${businessBToken}`)
        .set('x-business-id', businessBId)
        .set('x-branch-id', businessBBranchId);
      expect(getRes.status).toBe(404);

      // 3. Business B tries to CANCEL Business A's appointment -> 404
      const cancelRes = await request(app)
        .post(`/api/v1/businesses/${businessBId}/appointments/${apptAId}/cancel`)
        .set('Authorization', `Bearer ${businessBToken}`)
        .set('x-business-id', businessBId)
        .set('x-branch-id', businessBBranchId)
        .send({ cancellationReason: 'Malicious cancel attempt' });
      expect(cancelRes.status).toBe(404);

      // 4. Business B tries to STATUS-TRANSITION Business A's appointment -> 404
      const statusRes = await request(app)
        .post(`/api/v1/businesses/${businessBId}/appointments/${apptAId}/status`)
        .set('Authorization', `Bearer ${businessBToken}`)
        .set('x-business-id', businessBId)
        .set('x-branch-id', businessBBranchId)
        .send({ status: 'completed' });
      expect(statusRes.status).toBe(404);

      // 5. Business B tries to RESCHEDULE Business A's appointment -> 404
      const reschedRes = await request(app)
        .post(`/api/v1/businesses/${businessBId}/appointments/${apptAId}/reschedule`)
        .set('Authorization', `Bearer ${businessBToken}`)
        .set('x-business-id', businessBId)
        .set('x-branch-id', businessBBranchId)
        .send({ scheduledStartAt: '2030-12-10T14:00:00.000Z' });
      expect(reschedRes.status).toBe(404);
    });

    it('Multi-Service Same Staff: handles consecutive segments with buffers cleanly without self-conflict', async () => {
      // Create a second service (Beard Trim: 15 min + 10 min bufferAfter)
      const catRes = await request(app)
        .get(`/api/v1/businesses/${businessId}/service-categories`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId);
      const catId = catRes.body.data.categories[0].id;

      const svc2Res = await request(app)
        .post(`/api/v1/businesses/${businessId}/services`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId)
        .send({
          categoryId: catId,
          name: 'Beard Trim',
          defaultPrice: '20.00',
          defaultDurationMinutes: 15,
          bufferBeforeMinutes: 5,
          bufferAfterMinutes: 10,
        });
      const service2Id = svc2Res.body.data.service.id;

      // Assign service2 to branch
      const assignRes = await request(app)
        .post(`/api/v1/businesses/${businessId}/services/${service2Id}/branches`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId)
        .send({ branchId });
      expect(assignRes.status).toBe(201);

      // Assign service2 to staff member
      const assignStaffRes = await request(app)
        .post(`/api/v1/businesses/${businessId}/staff/${staffMemberId}/services`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId)
        .send({ serviceId: service2Id });
      expect(assignStaffRes.status).toBe(201);

      // Book multi-service: Haircut (60 min, 10 min buffer) + Beard Trim (15 min, 10 min buffer) with same staff
      const multiRes = await request(app)
        .post(`/api/v1/businesses/${businessId}/appointments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId)
        .set('x-branch-id', branchId)
        .send({
          branchId,
          businessCustomerId: customerId,
          scheduledStartAt: '2030-12-11T10:00:00.000Z',
          bookingChannel: 'business_dashboard',
          segments: [
            { serviceId, staffMemberId },
            { serviceId: service2Id, staffMemberId },
          ],
        });

      expect(multiRes.status).toBe(201);
      expect(multiRes.body.data.appointment.segments).toHaveLength(2);
      // Segment 1 (60 min): 10:00 - 11:00
      // Segment 2 (15 min): 11:00 - 11:15
      expect(new Date(multiRes.body.data.appointment.scheduledStartAt).toISOString()).toBe(
        '2030-12-11T10:00:00.000Z',
      );
      expect(new Date(multiRes.body.data.appointment.scheduledEndAt).toISOString()).toBe(
        '2030-12-11T11:15:00.000Z',
      );

      // Attempting to book Sarah during this multi-service window (e.g. at 10:30) conflicts!
      const overlapRes = await request(app)
        .post(`/api/v1/businesses/${businessId}/appointments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId)
        .set('x-branch-id', branchId)
        .send({
          branchId,
          businessCustomerId: customerId,
          scheduledStartAt: '2030-12-11T10:30:00.000Z',
          bookingChannel: 'business_dashboard',
          segments: [{ serviceId, staffMemberId }],
        });
      expect(overlapRes.status).toBe(409);
    });

    it('FSM Integrity: rejects illegal status transitions and re-completing terminal appointment', async () => {
      const createRes = await request(app)
        .post(`/api/v1/businesses/${businessId}/appointments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId)
        .set('x-branch-id', branchId)
        .send({
          branchId,
          businessCustomerId: customerId,
          scheduledStartAt: '2030-12-12T10:00:00.000Z',
          bookingChannel: 'business_dashboard',
          segments: [{ serviceId, staffMemberId }],
        });
      const apptId = createRes.body.data.appointment.id;

      // 1. Direct illegal transition: confirmed -> completed (skipping checked_in / in_progress)
      const illegalRes = await request(app)
        .post(`/api/v1/businesses/${businessId}/appointments/${apptId}/status`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId)
        .send({ status: 'completed' });
      expect(illegalRes.status).toBe(409);

      // 2. Transition properly: confirmed -> checked_in -> in_progress -> completed
      await request(app)
        .post(`/api/v1/businesses/${businessId}/appointments/${apptId}/status`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId)
        .send({ status: 'checked_in' });

      await request(app)
        .post(`/api/v1/businesses/${businessId}/appointments/${apptId}/status`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId)
        .send({ status: 'in_progress' });

      const compRes = await request(app)
        .post(`/api/v1/businesses/${businessId}/appointments/${apptId}/status`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId)
        .send({ status: 'completed' });
      expect(compRes.status).toBe(200);

      // 3. Attempting to transition from terminal completed -> 409
      const reCompRes = await request(app)
        .post(`/api/v1/businesses/${businessId}/appointments/${apptId}/status`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId)
        .send({ status: 'completed' });
      expect(reCompRes.status).toBe(409);
    });

    it('Input Validation: rejects invalid payload formats gracefully with 400', async () => {
      // 1. Invalid UUID
      const res1 = await request(app)
        .post(`/api/v1/businesses/${businessId}/appointments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId)
        .set('x-branch-id', branchId)
        .send({
          branchId: 'invalid-uuid',
          businessCustomerId: customerId,
          scheduledStartAt: '2030-12-13T10:00:00.000Z',
          segments: [{ serviceId, staffMemberId }],
        });
      expect(res1.status).toBe(400);

      // 2. Empty segments array
      const res2 = await request(app)
        .post(`/api/v1/businesses/${businessId}/appointments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId)
        .set('x-branch-id', branchId)
        .send({
          branchId,
          businessCustomerId: customerId,
          scheduledStartAt: '2030-12-13T10:00:00.000Z',
          segments: [],
        });
      expect(res2.status).toBe(400);

      // 3. Invalid date format
      const res3 = await request(app)
        .post(`/api/v1/businesses/${businessId}/appointments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId)
        .set('x-branch-id', branchId)
        .send({
          branchId,
          businessCustomerId: customerId,
          scheduledStartAt: 'tomorrow-morning',
          segments: [{ serviceId, staffMemberId }],
        });
      expect(res3.status).toBe(400);
    });
  });
});
