import {
  defineAnnotationProject,
  type VitestAnnotationProjectOptions,
} from '@integration-testing/testcontainers/vitest';
import { defineConfig } from 'vitest/config';

const eventStoreProject = (
  name: string,
  options: VitestAnnotationProjectOptions,
) => {
  const annotationProject = defineAnnotationProject(options);

  return {
    ...annotationProject,
    oxc: {
      decorator: {
        legacy: true,
      },
    },
    test: {
      ...annotationProject.test,
      name,
      environment: 'node',
      fileParallelism: false,
    },
  };
};

const postgresProject = eventStoreProject('postgres', {
  include: ['test/integration/**/*.postgres.integration.test.ts'],
  application: './test/integration/postgres-event-store.setup.ts',
  testFileSuffix: '.postgres.integration.test.ts',
  hookTimeout: 360_000,
  testTimeout: 30_000,
});

const sqlServerProject = eventStoreProject('sqlserver', {
  include: ['test/integration/**/*.sqlserver.integration.test.ts'],
  application: './test/integration/sqlserver-event-store.setup.ts',
  testFileSuffix: '.sqlserver.integration.test.ts',
  hookTimeout: 360_000,
  testTimeout: 30_000,
});

export default defineConfig({
  test: {
    projects: [postgresProject, sqlServerProject],
  },
});
