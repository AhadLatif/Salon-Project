import { defineConfig } from 'vitest/config';

// Self-contained test config for @salon/database.
// Cannot use createVitestConfig from @salon/testing: testing depends on database,
// so depending back would be circular. Uses the same default test DB convention
// as @salon/testing for consistency.
const defaultTestDb =
  process.env.TEST_DATABASE_URL ||
  'postgres://salon_admin:super_secret_password_123@127.0.0.1:5432/salon_test';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    fileParallelism: false,
    include: ['tests/*.test.ts'],
    testTimeout: 20000,
    env: {
      NODE_ENV: 'test',
      // Mirrors the convention in @salon/testing/createVitestConfig.
      // @salon/database transitively imports @salon/config, which validates
      // these env vars at import time, so they must be present for tests.
      JWT_SECRET: process.env.JWT_SECRET || 'super_secret_password_123abcdABC',
      DATABASE_URL: defaultTestDb,
    },
  },
});
