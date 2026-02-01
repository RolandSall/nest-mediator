import { Pool } from 'pg';
import { EventStoreConfig, IEventStoreRepository } from '../../interfaces/index.js';

/**
 * Schema manager interface for database schema operations.
 */
export interface ISchemaManager {
  ensureSchema(pool: Pool, tableName?: string): Promise<void>;
  createRepository(config: EventStoreConfig, pool: Pool, ownsPool: boolean): IEventStoreRepository;
}
