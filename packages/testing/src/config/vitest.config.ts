import { defineConfig } from 'vitest/config';

export interface VitestConfigOptions {
  include?: string[];
  testTimeout?: number;
}

export function createVitestConfig(options: VitestConfigOptions = {}) {
  const defaultTestDb =
    process.env.TEST_DATABASE_URL ||
    'postgres://salon_admin:super_secret_password_123@127.0.0.1:5432/salon_test';

  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = defaultTestDb;
  }
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'test';
  }
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'super_secret_password_123abcdABC';
  }

  return defineConfig({
    test: {
      globals: true,
      environment: 'node',
      include: options.include || ['tests/**/*.test.ts', 'src/**/*.test.ts'],
      testTimeout: options.testTimeout || 10000,
      env: {
        NODE_ENV: 'test',
        JWT_SECRET: process.env.JWT_SECRET,
        DATABASE_URL: defaultTestDb,
      },
    },
  });
}
