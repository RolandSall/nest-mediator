import { EventStoreConfig, IEventStoreRepository } from '../../interfaces/index.js';
import { AbstractConnectionStrategy } from './abstract-connection.strategy.js';
import { DbPool, IDialect } from '../dialects/dialect.interface.js';

/**
 * Strategy for creating repository with an existing pool injection.
 * User provides the pool via dependency injection token → ownsPool = false.
 *
 * No driver is loaded here at all — the pool already exists, so the user's own
 * import of `pg` / `mssql` is the only one involved.
 */
export class ExistingPoolStrategy extends AbstractConnectionStrategy {
  canHandle(config: EventStoreConfig): boolean {
    return !!config.useExistingPool;
  }

  protected async getPool(
    _config: EventStoreConfig,
    _dialect: IDialect,
    injectedArgs: unknown[]
  ): Promise<DbPool> {
    return injectedArgs[0] as DbPool;
  }

  protected getInjectTokens(config: EventStoreConfig): string[] {
    return [config.useExistingPool!];
  }

  protected getRepository(
    config: EventStoreConfig,
    dialect: IDialect,
    pool: DbPool,
    _injectedArgs: unknown[]
  ): IEventStoreRepository {
    return dialect.schemaManager.createRepository(config, pool, false);
  }
}
