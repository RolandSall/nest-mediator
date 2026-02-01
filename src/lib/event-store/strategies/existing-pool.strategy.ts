import { Pool } from 'pg';
import { EventStoreConfig, IEventStoreRepository } from '../../interfaces/index.js';
import { AbstractPostgresConnectionStrategy } from './abstract-postgres-connection.strategy.js';

/**
 * Strategy for creating repository with an existing pool injection.
 * User provides the pool via dependency injection token → ownsPool = false.
 */
export class ExistingPoolStrategy extends AbstractPostgresConnectionStrategy {
  canHandle(config: EventStoreConfig): boolean {
    return config.type === 'postgres' && !!config.useExistingPool;
  }

  protected getPool(_config: EventStoreConfig, injectedArgs: unknown[]): Pool {
    return injectedArgs[0] as Pool;
  }

  protected getInjectTokens(config: EventStoreConfig): string[] {
    return [config.useExistingPool!];
  }

  protected getRepository(config: EventStoreConfig, pool: Pool, _injectedArgs: unknown[]): IEventStoreRepository {
    return this.schemaManager.createRepository(config, pool, false);
  }
}
