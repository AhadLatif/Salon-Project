import { db } from '@salon/database';
import { truncateAllTables } from '@salon/testing';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';

describe('Customer API Routes Integration Tests', () => {
  const app = createApp();
  let accessToken: string;
  let businessId: string;

  beforeEach(async () => {
    await truncateAllTables(db);

    // 1. Register a user and get access token
    const registerResponse = await request(app).post('/api/v1/auth/register').send({
      firstName: 'Alice',
      lastName: 'Owner',
      email: 'alice.owner@example.com',
      password: 'SecurePassword123!',
    });
    accessToken = registerResponse.body.data.tokens.accessToken;

    // 2. Create a business (Owner role boot-strapped automatically)
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

  describe('Customer Profile Endpoints', () => {
    it('should complete customer creation, search, update, details and archive lifecycle', async () => {
      // 1. Create a customer profile
      const createRes = await request(app)
        .post(`/api/v1/businesses/${businessId}/customers`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId)
        .send({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          phoneNumber: '+14155551234',
          gender: 'male',
          dateOfBirth: '1990-05-20',
          marketingOptIn: true,
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.success).toBe(true);
      const customerId = createRes.body.data.customer.id;
      expect(createRes.body.data.customer.email).toBe('john.doe@example.com');

      // 2. Search customers with query & pagination
      const searchRes = await request(app)
        .get(`/api/v1/businesses/${businessId}/customers?search=john&page=1&limit=10`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId);

      expect(searchRes.status).toBe(200);
      expect(searchRes.body.data.customers).toHaveLength(1);
      expect(searchRes.body.data.total).toBe(1);
      expect(searchRes.body.meta.page).toBe(1);
      expect(searchRes.body.meta.limit).toBe(10);

      // 3. Update customer profile
      const updateRes = await request(app)
        .patch(`/api/v1/businesses/${businessId}/customers/${customerId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId)
        .send({
          firstName: 'Jonathan',
          phoneNumber: '+14155559999',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.customer.firstName).toBe('Jonathan');
      expect(updateRes.body.data.customer.phoneNumber).toBe('+14155559999');

      // 4. Retrieve customer details (card view)
      const detailsRes = await request(app)
        .get(`/api/v1/businesses/${businessId}/customers/${customerId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId);

      expect(detailsRes.status).toBe(200);
      expect(detailsRes.body.data.customer.id).toBe(customerId);
      expect(detailsRes.body.data.customer.tags).toEqual([]);

      // 5. Soft-archive customer
      const archiveRes = await request(app)
        .delete(`/api/v1/businesses/${businessId}/customers/${customerId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId);

      expect(archiveRes.status).toBe(200);
      expect(archiveRes.body.data.customer.status).toBe('archived');
    });

    it('should reject duplicate customer email in the same business with 409 Conflict', async () => {
      await request(app)
        .post(`/api/v1/businesses/${businessId}/customers`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId)
        .send({
          firstName: 'First',
          email: 'dup@example.com',
        });

      const duplicateRes = await request(app)
        .post(`/api/v1/businesses/${businessId}/customers`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId)
        .send({
          firstName: 'Second',
          email: 'DUP@example.com',
        });

      expect(duplicateRes.status).toBe(409);
      expect(duplicateRes.body.success).toBe(false);
    });

    it('should enforce multi-tenant IDOR protection on customer endpoints', async () => {
      const otherBusinessRes = await request(app)
        .post('/api/v1/businesses')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Other Salon',
          slug: 'other-salon',
          email: 'other@salon.com',
          phoneNumber: '+1987654321',
          countryCode: 'US',
          timezone: 'America/New_York',
          currency: 'USD',
        });
      const otherBusinessId = otherBusinessRes.body.data.business.id;

      // Request path with businessId but header with otherBusinessId -> 403 Forbidden
      const idorRes = await request(app)
        .get(`/api/v1/businesses/${businessId}/customers`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', otherBusinessId);

      expect(idorRes.status).toBe(403);
    });
  });

  describe('Customer Notes Endpoints', () => {
    it('should create, list, and delete internal CRM notes for a customer', async () => {
      const customerRes = await request(app)
        .post(`/api/v1/businesses/${businessId}/customers`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId)
        .send({
          firstName: 'Bob',
          phoneNumber: '+14155550000',
        });
      const customerId = customerRes.body.data.customer.id;

      // 1. Add Note
      const addNoteRes = await request(app)
        .post(`/api/v1/businesses/${businessId}/customers/${customerId}/notes`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId)
        .send({
          note: 'Customer requested blonde balayage with low heat dryer.',
        });

      expect(addNoteRes.status).toBe(201);
      const noteId = addNoteRes.body.data.note.id;
      expect(addNoteRes.body.data.note.note).toBe(
        'Customer requested blonde balayage with low heat dryer.',
      );

      // 2. List Notes
      const getNotesRes = await request(app)
        .get(`/api/v1/businesses/${businessId}/customers/${customerId}/notes`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId);

      expect(getNotesRes.status).toBe(200);
      expect(getNotesRes.body.data.notes).toHaveLength(1);

      // 3. Delete Note
      const deleteNoteRes = await request(app)
        .delete(`/api/v1/businesses/${businessId}/customers/${customerId}/notes/${noteId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId);

      expect(deleteNoteRes.status).toBe(200);
      expect(deleteNoteRes.body.data.deleted).toBe(true);
    });
  });

  describe('Customer Tags & Assignments Endpoints', () => {
    it('should manage tag catalog and customer tag assignments', async () => {
      const customerRes = await request(app)
        .post(`/api/v1/businesses/${businessId}/customers`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId)
        .send({
          firstName: 'Clara',
          phoneNumber: '+14155553333',
        });
      const customerId = customerRes.body.data.customer.id;

      // 1. Create Tag Definition
      const createTagRes = await request(app)
        .post(`/api/v1/businesses/${businessId}/customer-tags`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId)
        .send({
          name: 'VIP Client',
          color: '#FF5733',
          description: 'Top tier loyalty member',
        });

      expect(createTagRes.status).toBe(201);
      const tagId = createTagRes.body.data.tag.id;

      // 2. Assign Tag to Customer
      const assignRes = await request(app)
        .post(`/api/v1/businesses/${businessId}/customers/${customerId}/tags`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId)
        .send({ tagId });

      expect(assignRes.status).toBe(201);

      // 3. Check tag in customer details
      const detailsRes = await request(app)
        .get(`/api/v1/businesses/${businessId}/customers/${customerId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId);

      expect(detailsRes.status).toBe(200);
      expect(detailsRes.body.data.customer.tags).toHaveLength(1);
      expect(detailsRes.body.data.customer.tags[0].name).toBe('VIP Client');

      // 4. Unassign Tag
      const unassignRes = await request(app)
        .delete(`/api/v1/businesses/${businessId}/customers/${customerId}/tags/${tagId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId);

      expect(unassignRes.status).toBe(200);
      expect(unassignRes.body.data.unassigned).toBe(true);

      // 5. Delete Tag Definition
      const deleteTagRes = await request(app)
        .delete(`/api/v1/businesses/${businessId}/customer-tags/${tagId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-business-id', businessId);

      expect(deleteTagRes.status).toBe(200);
      expect(deleteTagRes.body.data.deleted).toBe(true);
    });
  });

  describe('B2C User Favorites Endpoints', () => {
    it('should allow authenticated user to add, list, and delete favorites', async () => {
      // 1. Add favorite salon
      const addFavRes = await request(app)
        .post('/api/v1/favorites')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          businessId,
        });

      expect(addFavRes.status).toBe(201);
      const favoriteId = addFavRes.body.data.favorite.id;

      // 2. List favorites
      const listFavRes = await request(app)
        .get('/api/v1/favorites')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(listFavRes.status).toBe(200);
      expect(listFavRes.body.data.favorites).toHaveLength(1);
      expect(listFavRes.body.data.favorites[0].businessId).toBe(businessId);

      // 3. Delete favorite
      const deleteFavRes = await request(app)
        .delete(`/api/v1/favorites/${favoriteId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(deleteFavRes.status).toBe(200);
      expect(deleteFavRes.body.data.deleted).toBe(true);

      // 4. Confirm list is empty
      const emptyListRes = await request(app)
        .get('/api/v1/favorites')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(emptyListRes.status).toBe(200);
      expect(emptyListRes.body.data.favorites).toHaveLength(0);
    });
  });
});
