import type { Pool } from 'pg';
import { EventStoreConfig, IEventStoreRepository } from '../../interfaces/index.js';
import { PostgresEventStoreRepository } from '../repositories/postgres-event-store.repository.js';
import { getPostgresSchema } from '../schema/postgres.schema.js';
import { DbPool, ISchemaManager } from '../dialects/dialect.interface.js';

/**
 * PostgreSQL schema manager implementation.
 */
export class PostgresSchemaManager implements ISchemaManager {
  async ensureSchema(pool: DbPool, tableName?: string): Promise<void> {
    const schema = getPostgresSchema(tableName ?? 'domain_events');
    await (pool as Pool).query(schema);
  }

  createRepository(config: EventStoreConfig, pool: DbPool, ownsPool: boolean): IEventStoreRepository {
    if (config.repository) {
      // User provided custom repository class - instantiate it
      // Custom repos receive (pool, tableName, ownsPool)
      const RepoClass = config.repository;
      return new (RepoClass as new (pool: Pool, tableName: string, ownsPool: boolean) => IEventStoreRepository)(
        pool as Pool,
        config.tableName ?? 'domain_events',
        ownsPool
      );
    }
    return new PostgresEventStoreRepository(pool as Pool, config.tableName, ownsPool);
  }
}
