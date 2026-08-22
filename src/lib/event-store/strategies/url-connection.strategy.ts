import { EventStoreConfig, IEventStoreRepository } from '../../interfaces/index.js';
import { AbstractConnectionStrategy } from './abstract-connection.strategy.js';
import { DbPool, IDialect } from '../dialects/dialect.interface.js';

/**
 * Strategy for creating repository with a connection URL.
 * Library creates and manages the pool → ownsPool = true.
 *
 * Works for any configured `type` — the dialect decides which driver to load.
 */
export class UrlConnectionStrategy extends AbstractConnectionStrategy {
  canHandle(config: EventStoreConfig): boolean {
    return !!config.url && !config.useExistingPool;
  }

  protected async getPool(
    config: EventStoreConfig,
    dialect: IDialect,
    _injectedArgs: unknown[]
  ): Promise<DbPool> {
    return dialect.createPool(config.url!);
  }

  protected getInjectTokens(_config: EventStoreConfig): string[] {
    return [];
  }

  protected getRepository(
    config: EventStoreConfig,
    dialect: IDialect,
    pool: DbPool,
    _injectedArgs: unknown[]
  ): IEventStoreRepository {
    // We created the pool, so we own it → ownsPool = true
    return dialect.schemaManager.createRepository(config, pool, true);
  }
}
