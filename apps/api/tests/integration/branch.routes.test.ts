import { db } from '@salon/database';
import { truncateAllTables } from '@salon/testing';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';

describe('Branch Routes Integration Tests', () => {
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

    // 2. Create a business (Alice becomes the Owner)
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

  it('POST /api/v1/businesses/:id/branches - should successfully create a branch with opening hours', async () => {
    const response = await request(app)
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

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.branch.name).toBe('Downtown Branch');
    expect(response.body.data.branch.openingHours.length).toBe(1);
    expect(response.body.data.branch.openingHours[0].opensAt).toBe('09:00:00'); // DB might return with seconds
  });

  it('POST /api/v1/businesses/:id/branches - should fail if opening hours missing', async () => {
    const response = await request(app)
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
        openingHours: [],
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('POST /api/v1/businesses/:id/branches - should deny access without x-business-id header', async () => {
    const response = await request(app)
      .post(`/api/v1/businesses/${businessId}/branches`)
      .set('Authorization', `Bearer ${accessToken}`)
      // Missing x-business-id
      .send({
        name: 'Downtown Branch',
        timezone: 'America/New_York',
        currency: 'USD',
        addressLine1: '123 Main St',
        city: 'New York',
        countryCode: 'US',
        openingHours: [{ dayOfWeek: 1, isClosed: true, opensAt: null, closesAt: null }],
      });

    expect(response.status).toBe(400); // validation error on header
    expect(response.body.error.message).toContain('Missing or invalid x-business-id');
  });
});
