import { db } from '@salon/database';
import { truncateAllTables } from '@salon/testing';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';

describe('Business Routes Integration Tests', () => {
  const app = createApp();
  let accessToken: string;

  beforeEach(async () => {
    await truncateAllTables(db);

    const registerResponse = await request(app).post('/api/v1/auth/register').send({
      firstName: 'Alice',
      lastName: 'Owner',
      email: 'alice.owner@example.com',
      password: 'SecurePassword123!',
    });
    accessToken = registerResponse.body.data.tokens.accessToken;
  });

  it('POST /api/v1/businesses - should create a business with Owner role', async () => {
    const response = await request(app)
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

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.business.name).toBe('Alice Salon');
    expect(response.body.data.business.slug).toBe('alice-salon');
    // Contract guard: `ownerUserId` is NOT part of the published OpenAPI schema (business.openapi.ts).
    // It used to leak here as a synthesised value that cost an extra JOIN on every read — and in the
    // list endpoint it reported the CALLER's id as the owner. Assert absence so it cannot creep back.
    expect(response.body.data.business).not.toHaveProperty('ownerUserId');
    expect(response.body).toHaveProperty('error', null);
  });

  it('GET /api/v1/businesses/me - should return businesses for authenticated user', async () => {
    await request(app)
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

    const response = await request(app)
      .get('/api/v1/businesses/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.businesses).toHaveLength(1);
    expect(response.body.data.businesses[0].name).toBe('Alice Salon');
    // Shape parity: the list endpoint used to hand-pick a subset of columns and silently omit
    // `verifiedAt`, so one entity had two different shapes depending on the endpoint. `getUserBusinesses`
    // now selects every `businesses` column, so list and detail must expose the same field set.
    expect(response.body.data.businesses[0]).toHaveProperty('verifiedAt');
    expect(response.body.data.businesses[0]).not.toHaveProperty('ownerUserId');
  });

  it('GET /api/v1/businesses/:id - should require x-business-id header', async () => {
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

    const businessId = businessResponse.body.data.business.id;

    const response = await request(app)
      .get(`/api/v1/businesses/${businessId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain('Missing or invalid x-business-id');
  });

  it('GET /api/v1/businesses/:id - should return business with valid x-business-id', async () => {
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

    const businessId = businessResponse.body.data.business.id;

    const response = await request(app)
      .get(`/api/v1/businesses/${businessId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-business-id', businessId);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.business.id).toBe(businessId);
  });
});
