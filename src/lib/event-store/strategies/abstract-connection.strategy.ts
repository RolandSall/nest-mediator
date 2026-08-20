import { Provider, Logger } from '@nestjs/common';
import { EventStoreConfig, IEventStoreRepository, EVENT_STORE_REPOSITORY } from '../../interfaces/index.js';
import { IEventStoreStrategy } from './event-store-strategy.interface.js';
import { DbPool, IDialect } from '../dialects/dialect.interface.js';
import { resolveDialect } from '../dialects/index.js';

const logger = new Logger('EventStore');

/**
 * Abstract base class for event store connection strategies.
 *
 * Strategies describe *how the connection is obtained* (a URL, an injected pool, a
 * user-supplied repository). Which database engine is spoken is a separate concern,
 * resolved from `config.type` into an {@link IDialect}. That split is what lets one
 * strategy serve every supported engine.
 *
 * Uses Template Method pattern - subclasses implement:
 * - getPool(): how to obtain the database pool
 * - getInjectTokens(): what to inject into the factory
 * - getRepository(): how to obtain the repository after schema is ensured
 */
export abstract class AbstractConnectionStrategy implements IEventStoreStrategy {
  abstract canHandle(config: EventStoreConfig): boolean;

  invoke(config: EventStoreConfig): Provider[] {
    return [
      {
        provide: EVENT_STORE_REPOSITORY,
        useFactory: async (...args: unknown[]) => {
          // Resolving the dialect performs no I/O and loads no driver; the driver
          // import happens inside getPool() only when a pool is actually created.
          const dialect = resolveDialect(config.type);
          const pool = await this.getPool(config, dialect, args);
          logger.log(`Ensuring event store schema exists (${dialect.name})...`);
          await dialect.schemaManager.ensureSchema(pool, config.tableName);
          logger.log('Event store schema ready');
          return this.getRepository(config, dialect, pool, args);
        },
        inject: this.getInjectTokens(config),
      },
    ];
  }

  protected abstract getPool(
    config: EventStoreConfig,
    dialect: IDialect,
    injectedArgs: unknown[]
  ): Promise<DbPool>;

  protected abstract getInjectTokens(config: EventStoreConfig): string[];

  protected abstract getRepository(
    config: EventStoreConfig,
    dialect: IDialect,
    pool: DbPool,
    injectedArgs: unknown[]
  ): IEventStoreRepository | Promise<IEventStoreRepository>;
}
