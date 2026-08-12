import { db } from '@salon/database';
import { truncateAllTables } from '@salon/testing';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';

describe('RBAC Routes Integration Tests', () => {
  const app = createApp();
  let accessToken: string;
  let businessId: string;

  beforeEach(async () => {
    await truncateAllTables(db);

    const registerResponse = await request(app).post('/api/v1/auth/register').send({
      firstName: 'Alice',
      lastName: 'Owner',
      email: 'alice.owner@example.com',
      password: 'SecurePassword123!',
    });
    accessToken = registerResponse.body.data.tokens.accessToken;

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

  it('GET /api/v1/businesses/permissions/catalog - should return permissions catalog', async () => {
    const response = await request(app)
      .get('/api/v1/businesses/permissions/catalog')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.permissions).toBeDefined();
    expect(Array.isArray(response.body.data.permissions)).toBe(true);
  });

  it('GET /api/v1/businesses/:id/roles - should require auth and tenant context', async () => {
    const response = await request(app)
      .get(`/api/v1/businesses/${businessId}/roles`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain('Missing or invalid x-business-id');
  });

  it('GET /api/v1/businesses/:id/roles - should return Owner role with valid tenant context', async () => {
    const response = await request(app)
      .get(`/api/v1/businesses/${businessId}/roles`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-business-id', businessId);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.roles).toHaveLength(1);
    expect(response.body.data.roles[0].name).toBe('Owner');
  });

  it('POST /api/v1/businesses/:id/roles - should create a custom role', async () => {
    const response = await request(app)
      .post(`/api/v1/businesses/${businessId}/roles`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-business-id', businessId)
      .send({
        name: 'Manager',
        description: 'Can manage appointments',
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.role.name).toBe('Manager');
  });

  it('POST /api/v1/businesses/:id/roles - should reject duplicate role name', async () => {
    await request(app)
      .post(`/api/v1/businesses/${businessId}/roles`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-business-id', businessId)
      .send({
        name: 'Manager',
        description: 'First',
      });

    const response = await request(app)
      .post(`/api/v1/businesses/${businessId}/roles`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-business-id', businessId)
      .send({
        name: 'Manager',
        description: 'Duplicate',
      });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
  });

  it('PATCH /api/v1/businesses/:id/roles/:roleId - should update role permissions', async () => {
    const createResponse = await request(app)
      .post(`/api/v1/businesses/${businessId}/roles`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-business-id', businessId)
      .send({
        name: 'Manager',
        description: 'Can manage appointments',
      });

    const roleId = createResponse.body.data.role.id;

    const response = await request(app)
      .patch(`/api/v1/businesses/${businessId}/roles/${roleId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-business-id', businessId)
      .send({
        permissions: [],
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.role.permissions).toHaveLength(0);
  });
});
