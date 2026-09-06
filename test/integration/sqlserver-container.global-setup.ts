import { createDefaultContainerRegistry } from '@integration-testing/testcontainers';
import { createVitestContainerGlobalSetup } from '@integration-testing/testcontainers/vitest';

const lifecycle = createVitestContainerGlobalSetup({
  root: process.cwd(),
  testFileSuffix: 'sqlserver-event-store.integration.test.ts',
  registry: createDefaultContainerRegistry({
    sqlServer: {
      image: 'mcr.microsoft.com/mssql/server:2022-latest',
      password: 'NestMediator!2026',
      platform: 'linux/amd64',
      startupTimeoutMs: 300_000,
    },
  }),
});

export const setup = lifecycle.setup;
export const teardown = lifecycle.teardown;
