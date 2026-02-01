import { Pool } from 'pg';
import { EventStoreConfig, IEventStoreRepository } from '../../interfaces/index.js';
import { AbstractPostgresConnectionStrategy } from './abstract-postgres-connection.strategy.js';

/**
 * Strategy for creating repository with a connection URL.
 * Library creates and manages the pool → ownsPool = true.
 */
export class UrlConnectionStrategy extends AbstractPostgresConnectionStrategy {
  canHandle(config: EventStoreConfig): boolean {
    return config.type === 'postgres' && !!config.url && !config.useExistingPool;
  }

  protected getPool(config: EventStoreConfig, _injectedArgs: unknown[]): Pool {
    return new Pool({ connectionString: config.url });
  }

  protected getInjectTokens(_config: EventStoreConfig): string[] {
    return [];
  }

  protected getRepository(config: EventStoreConfig, pool: Pool, _injectedArgs: unknown[]): IEventStoreRepository {
    // We created the pool, so we own it → ownsPool = true
    return this.schemaManager.createRepository(config, pool, true);
  }
}
