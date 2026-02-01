import { Provider, Logger } from '@nestjs/common';
import { EventStoreConfig, IEventStoreRepository, EVENT_STORE_REPOSITORY } from '../../interfaces/index.js';
import { EventStorePersistenceConsumer } from '../event-store-persistence.consumer.js';
import { EventBus } from '../../services/event.bus.js';
import { IEventStoreStrategy } from './event-store-strategy.interface.js';

const logger = new Logger('EventStore');

/**
 * Strategy for registering the persistence consumer.
 */
export class PersistenceConsumerStrategy implements IEventStoreStrategy {
  canHandle(_config: EventStoreConfig): boolean {
    return true;
  }

  invoke(config: EventStoreConfig): Provider[] {
    return [
      {
        provide: 'EVENT_STORE_PERSISTENCE_CONSUMER',
        useFactory: (repo: IEventStoreRepository, eventBus: EventBus) => {
          const consumer = new EventStorePersistenceConsumer(repo, config);
          eventBus.registerSystemConsumer(consumer, 'EventStorePersistenceConsumer');
          logger.log(`Event store persistence consumer registered (mode: ${config.mode || 'audit'})`);
          return consumer;
        },
        inject: [EVENT_STORE_REPOSITORY, EventBus],
      },
    ];
  }
}
