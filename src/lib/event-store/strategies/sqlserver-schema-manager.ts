import type { ConnectionPool } from 'mssql';
import type * as mssql from 'mssql';
import { EventStoreConfig, IEventStoreRepository } from '../../interfaces/index.js';
import { MssqlEventStoreRepository } from '../repositories/mssql-event-store.repository.js';
import { getSqlServerSchema } from '../schema/sqlserver.schema.js';
import { DbPool, ISchemaManager, loadDriver } from '../dialects/dialect.interface.js';

/**
 * SQL Server schema manager implementation.
 *
 * The `mssql` module is loaded here rather than injected because `createRepository`
 * is synchronous by contract. `ensureSchema` always runs first (see
 * AbstractConnectionStrategy.invoke), so the driver is guaranteed to be resolved by
 * the time a repository is built — including the useExistingPool case, where no
 * pool is created by us and `createPool` never runs.
 */
export class SqlServerSchemaManager implements ISchemaManager {
  private driver?: typeof mssql;

  async ensureSchema(pool: DbPool, tableName?: string): Promise<void> {
    this.driver ??= await loadDriver<typeof mssql>('mssql', 'sqlserver');
    const schema = getSqlServerSchema(tableName ?? 'domain_events');
    // batch() rather than query(): the schema is multiple statements including
    // IF/BEGIN/END blocks, which query() cannot parameterise or split.
    await (pool as ConnectionPool).request().batch(schema);
  }

  createRepository(
    config: EventStoreConfig,
    pool: DbPool,
    ownsPool: boolean
  ): IEventStoreRepository {
    if (!this.driver) {
      throw new Error(
        'SQL Server driver not initialised. ensureSchema() must run before createRepository().'
      );
    }

    if (config.repository) {
      // User provided custom repository class - instantiate it
      // Custom repos receive (pool, tableName, ownsPool)
      const RepoClass = config.repository;
      return new (RepoClass as new (
        pool: ConnectionPool,
        tableName: string,
        ownsPool: boolean
      ) => IEventStoreRepository)(
        pool as ConnectionPool,
        config.tableName ?? 'domain_events',
        ownsPool
      );
    }

    return new MssqlEventStoreRepository(
      pool as ConnectionPool,
      this.driver,
      config.tableName,
      ownsPool
    );
  }
}
