import {
  fromContainer,
  postgreSql,
} from '@integration-testing/testcontainers';
import { defineContainerProject } from '@integration-testing/testcontainers/vitest';

const containerProject = defineContainerProject({
  include: [
    'test/resilience/event-publishing.integration.test.ts',
    'test/resilience/source-aggregate.integration.test.ts',
  ],
  containers: {
    database: postgreSql({
      image: 'postgres:15-alpine',
      database: 'mediator_resilience',
      username: 'mediator',
      password: 'mediator123',
    }),
  },
  application: {
    setup: './test/resilience/application.setup.ts',
    environment: {
      DATABASE_URL: fromContainer('database', 'connectionUri'),
    },
  },
  hookTimeout: 360_000,
  testTimeout: 30_000,
});

export default {
  ...containerProject,
  test: {
    ...containerProject.test,
    fileParallelism: false,
  },
};
