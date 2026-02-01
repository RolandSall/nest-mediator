import { Provider } from '@nestjs/common';
import { EventStoreConfig } from '../../interfaces/index.js';
import { IEventStoreStrategy } from './event-store-strategy.interface.js';
import { ExistingPoolStrategy } from './existing-pool.strategy.js';
import { UrlConnectionStrategy } from './url-connection.strategy.js';
import { CustomRepositoryStrategy } from './custom-repository.strategy.js';
import { PersistenceConsumerStrategy } from './persistence-consumer.strategy.js';

// Interfaces
export { IEventStoreStrategy } from './event-store-strategy.interface.js';
export { ISchemaManager } from './schema-manager.interface.js';

// Implementations
export { PostgresSchemaManager } from './postgres-schema-manager.js';
export { AbstractPostgresConnectionStrategy } from './abstract-postgres-connection.strategy.js';
export { ExistingPoolStrategy } from './existing-pool.strategy.js';
export { UrlConnectionStrategy } from './url-connection.strategy.js';
export { CustomRepositoryStrategy } from './custom-repository.strategy.js';
export { PersistenceConsumerStrategy } from './persistence-consumer.strategy.js';

/**
 * Repository strategies - only ONE should match based on config.
 * Order matters: more specific checks first.
 */
const repositoryStrategies: IEventStoreStrategy[] = [
  new CustomRepositoryStrategy(),  // Option 3: useExistingRepository
  new ExistingPoolStrategy(),      // Option 2: useExistingPool
  new UrlConnectionStrategy(),     // Option 1: url
];

/**
 * Persistence consumer - always runs after repository is configured.
 */
const persistenceConsumerStrategy = new PersistenceConsumerStrategy();

/**
 * Configure event store by:
 * 1. Running ONE matching repository strategy
 * 2. Always registering the persistence consumer
 */
export function configureEventStore(
  providers: Provider[],
  config: EventStoreConfig
): void {
  // 1. Find and run the matching repository strategy (only one)
  for (const strategy of repositoryStrategies) {
    if (strategy.canHandle(config)) {
      providers.push(...strategy.invoke(config));
      break;
    }
  }

  providers.push(...persistenceConsumerStrategy.invoke(config));
}
