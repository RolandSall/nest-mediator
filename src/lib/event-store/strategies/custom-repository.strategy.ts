import { Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { EventStoreConfig, IEventStoreRepository } from '../../interfaces/index.js';
import { AbstractPostgresConnectionStrategy } from './abstract-postgres-connection.strategy.js';

const logger = new Logger('EventStore');

/**
 * Strategy for using a user-provided repository via dependency injection.
 *
 * - getPool(): creates temporary pool from url (for schema creation only)
 * - getInjectTokens(): injects user's repository
 * - getRepository(): closes temp pool, returns user's injected repository
 */
export class CustomRepositoryStrategy extends AbstractPostgresConnectionStrategy {
  canHandle(config: EventStoreConfig): boolean {
    return !!config.useExistingRepository;
  }

  protected getPool(config: EventStoreConfig, _injectedArgs: unknown[]): Pool {
    if (!config.url) {
      throw new Error('url is required for schema creation with useExistingRepository');
    }
    return new Pool({ connectionString: config.url });
  }

  protected getInjectTokens(config: EventStoreConfig): string[] {
    return [config.useExistingRepository!];
  }

  /**
   * Override: close the temporary pool and return user's injected repository.
   */
  protected async getRepository(
    _config: EventStoreConfig,
    pool: Pool,
    injectedArgs: unknown[]
  ): Promise<IEventStoreRepository> {
    await pool.end();
    logger.log('Temporary pool closed');
    return injectedArgs[0] as IEventStoreRepository;
  }
}
