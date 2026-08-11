import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    testTimeout: 10000,
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: process.env.JWT_SECRET || 'super_secret_password_123abcdABC',
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ||
        'postgres://salon_admin:super_secret_password_123@localhost:5432/salon_test',
    },
  },
});
