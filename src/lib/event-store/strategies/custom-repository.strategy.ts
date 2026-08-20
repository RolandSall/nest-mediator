import { Logger } from '@nestjs/common';
import { EventStoreConfig, IEventStoreRepository } from '../../interfaces/index.js';
import { AbstractConnectionStrategy } from './abstract-connection.strategy.js';
import { DbPool, IDialect } from '../dialects/dialect.interface.js';

const logger = new Logger('EventStore');

/**
 * Strategy for using a user-provided repository via dependency injection.
 *
 * - getPool(): creates temporary pool from url (for schema creation only)
 * - getInjectTokens(): injects user's repository
 * - getRepository(): closes temp pool, returns user's injected repository
 *
 * The temporary pool is created through the dialect, so a SQL Server user with a
 * custom repository gets a SQL Server pool rather than a PostgreSQL one.
 */
export class CustomRepositoryStrategy extends AbstractConnectionStrategy {
  canHandle(config: EventStoreConfig): boolean {
    return !!config.useExistingRepository;
  }

  protected async getPool(
    config: EventStoreConfig,
    dialect: IDialect,
    _injectedArgs: unknown[]
  ): Promise<DbPool> {
    if (!config.url) {
      throw new Error('url is required for schema creation with useExistingRepository');
    }
    return dialect.createPool(config.url);
  }

  protected getInjectTokens(config: EventStoreConfig): string[] {
    return [config.useExistingRepository!];
  }

  /**
   * Override: close the temporary pool and return user's injected repository.
   */
  protected async getRepository(
    _config: EventStoreConfig,
    dialect: IDialect,
    pool: DbPool,
    injectedArgs: unknown[]
  ): Promise<IEventStoreRepository> {
    await dialect.closePool(pool);
    logger.log('Temporary pool closed');
    return injectedArgs[0] as IEventStoreRepository;
  }
}
