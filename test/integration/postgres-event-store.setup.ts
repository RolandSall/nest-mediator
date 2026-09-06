import {
  Container,
  type PostgreSqlResource,
} from '@integration-testing/testcontainers';
import { installVitestApplicationIntegrationTestSupport } from '@integration-testing/testcontainers/vitest';
import { Pool } from 'pg';

export const postgresEventStoreContext =
  installVitestApplicationIntegrationTestSupport<Pool>({
    start: async (resources) => {
      const database: PostgreSqlResource = resources.get(Container.PostgreSql);
      const pool = new Pool({ connectionString: database.connectionUri });
      await pool.query('SELECT 1');
      return pool;
    },
    stop: (pool) => pool.end(),
  });
