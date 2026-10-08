import { config } from '@salon/config';
import { db } from '@salon/database';
import { truncateAllTables } from '@salon/testing';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { marketplaceRateLimiter } from '../../src/http/middlewares/marketplace-rate-limiter.js';

const PING = '/api/v1/marketplace/ping';

describe('Marketplace API Routes Integration Tests', () => {
  const app = createApp();

  // Every other integration test in this package truncates first. Without it this file
  // observes whatever the previous file left behind in the shared `salon_test` database.
  beforeEach(async () => {
    await truncateAllTables(db);
  });

  // The limiter holds an in-memory counter keyed by client IP. Leaving it exhausted leaks
  // that state into whatever runs next in this worker, so clear both loopback spellings.
  afterAll(() => {
    marketplaceRateLimiter.resetKey('::ffff:127.0.0.1');
    marketplaceRateLimiter.resetKey('127.0.0.1');
  });

  it('serves an anonymous caller and returns the standard envelope + CORS headers', async () => {
    const frontendUrl = config.marketplace.corsOrigins[0];

    const response = await request(app)
      .get(PING)
      .set('Origin', frontendUrl ?? '');

    expect(response.status).toBe(200);
    // Envelope, not a hand-written body — this is the BUG-06 regression guard.
    expect(response.body.success).toBe(true);
    expect(response.body.error).toBeNull();
    expect(response.body.data).toEqual({ message: 'Pong! Welcome anonymous guest' });
    expect(response.headers['access-control-allow-origin']).toBe(frontendUrl);
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('rate limits the public surface and returns the standard error envelope', async () => {
    const limit = config.marketplace.rateLimit.max;
    let lastResponse = await request(app).get(PING);

    // Drive until the limiter trips rather than assuming a fixed count.
    for (let i = 0; i <= limit && lastResponse.status === 200; i += 1) {
      lastResponse = await request(app).get(PING);
    }

    expect(lastResponse.status).toBe(429);
    expect(lastResponse.body.success).toBe(false);
    expect(lastResponse.body.error.code).toBe('TOO_MANY_REQUESTS');
    expect(lastResponse.headers['ratelimit-limit']).toBeDefined();
  });
});
