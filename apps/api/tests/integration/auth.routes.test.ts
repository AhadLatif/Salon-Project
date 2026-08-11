import { db } from '@salon/database';
import { truncateAllTables } from '@salon/testing';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';

describe('Auth API Routes Integration Tests', () => {
  const app = createApp();

  beforeEach(async () => {
    await truncateAllTables(db);
  });

  it('POST /api/v1/auth/register - should successfully register a new user', async () => {
    const response = await request(app).post('/api/v1/auth/register').send({
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'alice.smith@example.com',
      password: 'SecurePassword123!',
    });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
    expect(response.body.data.user.email).toBe('alice.smith@example.com');
    expect(response.body.data.tokens.accessToken).toBeDefined();
    expect(response.body.data.tokens.refreshToken).toBeDefined();
  });

  it('POST /api/v1/auth/login - should log in existing user with correct password', async () => {
    // 1. Register user
    await request(app).post('/api/v1/auth/register').send({
      firstName: 'Bob',
      lastName: 'Jones',
      email: 'bob.jones@example.com',
      password: 'Password123!',
    });

    // 2. Login user
    const loginResponse = await request(app).post('/api/v1/auth/login').send({
      email: 'bob.jones@example.com',
      password: 'Password123!',
    });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.success).toBe(true);
    expect(loginResponse.body.data.tokens.accessToken).toBeDefined();
  });

  it('POST /api/v1/auth/login - should return 401 for incorrect password', async () => {
    // 1. Register user
    await request(app).post('/api/v1/auth/register').send({
      firstName: 'Charlie',
      lastName: 'Brown',
      email: 'charlie@example.com',
      password: 'Password123!',
    });

    // 2. Login with wrong password
    const loginResponse = await request(app).post('/api/v1/auth/login').send({
      email: 'charlie@example.com',
      password: 'WrongPassword!',
    });

    expect(loginResponse.status).toBe(401);
    expect(loginResponse.body.success).toBe(false);
  });
});
