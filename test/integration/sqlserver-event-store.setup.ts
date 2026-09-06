import {
  Container,
  type SqlServerResource,
} from '@integration-testing/testcontainers';
import { installVitestApplicationIntegrationTestSupport } from '@integration-testing/testcontainers/vitest';
import type { ConnectionPool } from 'mssql';
import { SqlServerDialect } from '../../src/lib/event-store/dialects/sqlserver.dialect.js';
import type { IEventStoreRepository } from '../../src/lib/interfaces/event-store.interface.js';

export interface SqlServerEventStoreTestContext {
  dialect: SqlServerDialect;
  pool: ConnectionPool;
  repository: IEventStoreRepository;
  tableName: string;
}

function buildUrl(resource: SqlServerResource, database = 'master'): string {
  return (
    `Server=${resource.host},${resource.port};Database=${database};` +
    `User Id=${resource.username};Password=${resource.password};` +
    'Encrypt=false;TrustServerCertificate=true'
  );
}

export const sqlServerEventStoreContext =
  installVitestApplicationIntegrationTestSupport<SqlServerEventStoreTestContext>({
    start: async (resources) => {
      const database = resources.get(Container.SqlServer);
      const dialect = new SqlServerDialect();
      const adminPool = await dialect.createPool(
        buildUrl(database),
      ) as ConnectionPool;
      await adminPool
        .request()
        .batch("IF DB_ID('mediator_it') IS NULL CREATE DATABASE mediator_it;");
      await dialect.closePool(adminPool);

      const pool = await dialect.createPool(
        buildUrl(database, 'mediator_it'),
      ) as ConnectionPool;
      const tableName = `it_events_${Date.now()}`;
      await dialect.schemaManager.ensureSchema(pool, tableName);
      const repository = dialect.schemaManager.createRepository(
        { type: 'sqlserver', tableName },
        pool,
        false,
      );

      return { dialect, pool, repository, tableName };
    },
    stop: ({ dialect, pool }) => dialect.closePool(pool),
  });
