import { defineConfig } from 'vitest/config';

export default defineConfig({
  oxc: {
    decorator: {
      legacy: true,
    },
  },
  test: {
    environment: 'node',
    include: ['test/integration/postgres-event-store.integration.test.ts'],
    globalSetup: ['./test/integration/postgres-container.global-setup.ts'],
    setupFiles: ['./test/integration/postgres-event-store.setup.ts'],
    fileParallelism: false,
    hookTimeout: 360_000,
    testTimeout: 30_000,
  },
});
