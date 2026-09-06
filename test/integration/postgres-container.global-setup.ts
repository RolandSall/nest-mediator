import { createDefaultContainerRegistry } from '@integration-testing/testcontainers';
import { createVitestContainerGlobalSetup } from '@integration-testing/testcontainers/vitest';

const lifecycle = createVitestContainerGlobalSetup({
  root: process.cwd(),
  testFileSuffix: 'postgres-event-store.integration.test.ts',
  registry: createDefaultContainerRegistry({
    postgreSql: {
      image: 'postgres:15-alpine',
      username: 'mediator',
      password: 'mediator123',
      database: 'mediator_test',
    },
  }),
});

export const setup = lifecycle.setup;
export const teardown = lifecycle.teardown;
