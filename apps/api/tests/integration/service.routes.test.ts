import { db } from '@salon/database';
import { truncateAllTables } from '@salon/testing';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';

describe('Service Routes Integration Tests', () => {
  const app = createApp();
  let accessToken: string;
  let businessId: string;

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

    // 2. Create a business
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
  });

  it('should run a complete service creation and branch assignment flow', async () => {
    // 1. Create a Service Category
    const categoryResponse = await request(app)
      .post(`/api/v1/businesses/${businessId}/service-categories`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-business-id', businessId)
      .send({
        name: 'Haircuts',
      });

    expect(categoryResponse.status).toBe(201);
    const categoryId = categoryResponse.body.data.category.id;

    // 2. Create a Service in that category
    const serviceResponse = await request(app)
      .post(`/api/v1/businesses/${businessId}/services`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-business-id', businessId)
      .send({
        categoryId,
        name: 'Mens Haircut',
        defaultPrice: '30.00',
        defaultDurationMinutes: 30,
      });

    expect(serviceResponse.status).toBe(201);
    const serviceId = serviceResponse.body.data.service.id;

    // 3. Create a Branch to assign the service to
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
        openingHours: [
          {
            dayOfWeek: 1,
            isClosed: false,
            opensAt: '09:00',
            closesAt: '17:00',
          },
        ],
      });

    expect(branchResponse.status).toBe(201);
    const branchId = branchResponse.body.data.branch.id;

    // 4. Assign the Service to the Branch
    const assignResponse = await request(app)
      .post(`/api/v1/businesses/${businessId}/services/${serviceId}/branches`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-business-id', businessId)
      .send({
        branchId,
        isBookable: true,
      });

    expect(assignResponse.status).toBe(201);

    // 5. Verify the Assignment via GET endpoint
    const getAssignmentsResponse = await request(app)
      .get(`/api/v1/businesses/${businessId}/services/${serviceId}/branches`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-business-id', businessId);

    expect(getAssignmentsResponse.status).toBe(200);
    expect(getAssignmentsResponse.body.data.assignments).toHaveLength(1);
    expect(getAssignmentsResponse.body.data.assignments[0].branchId).toBe(branchId);
    expect(getAssignmentsResponse.body.data.assignments[0].isBookable).toBe(true);
  });
});
