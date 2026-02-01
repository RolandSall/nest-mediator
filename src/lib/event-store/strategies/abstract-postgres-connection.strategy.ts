import { Provider, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { EventStoreConfig, IEventStoreRepository, EVENT_STORE_REPOSITORY } from '../../interfaces/index.js';
import { IEventStoreStrategy } from './event-store-strategy.interface.js';
import { ISchemaManager } from './schema-manager.interface.js';
import { PostgresSchemaManager } from './postgres-schema-manager.js';

const logger = new Logger('EventStore');

/**
 * Abstract base class for PostgreSQL connection strategies.
 * Uses Template Method pattern - subclasses implement:
 * - getPool(): how to obtain the database pool
 * - getInjectTokens(): what to inject into the factory
 * - getRepository(): how to obtain the repository after schema is ensured
 */
export abstract class AbstractPostgresConnectionStrategy implements IEventStoreStrategy {
  protected readonly schemaManager: ISchemaManager = new PostgresSchemaManager();

  abstract canHandle(config: EventStoreConfig): boolean;

  invoke(config: EventStoreConfig): Provider[] {
    return [
      {
        provide: EVENT_STORE_REPOSITORY,
        useFactory: async (...args: unknown[]) => {
          const pool = await this.getPool(config, args);
          logger.log('Ensuring event store schema exists...');
          await this.schemaManager.ensureSchema(pool, config.tableName);
          logger.log('Event store schema ready');
          return this.getRepository(config, pool, args);
        },
        inject: this.getInjectTokens(config),
      },
    ];
  }

  protected abstract getPool(config: EventStoreConfig, injectedArgs: unknown[]): Promise<Pool> | Pool;
  protected abstract getInjectTokens(config: EventStoreConfig): string[];
  protected abstract getRepository(
    config: EventStoreConfig,
    pool: Pool,
    injectedArgs: unknown[]
  ): IEventStoreRepository | Promise<IEventStoreRepository>;
}
