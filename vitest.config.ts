import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/modules/*', 'packages/testing', 'apps/*'],
    fileParallelism: false,
  },
});
