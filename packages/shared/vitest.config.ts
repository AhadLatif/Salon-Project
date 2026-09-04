import { defineConfig } from 'vitest/config';

// Minimal, framework-agnostic test config for @salon/shared.
// This package must NOT depend on @salon/testing (testing depends on shared),
// so it does not use createVitestConfig. These helpers are pure and DB-free.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/*.test.ts'],
  },
});
