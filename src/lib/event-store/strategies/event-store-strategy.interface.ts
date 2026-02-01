import { Provider } from '@nestjs/common';
import { EventStoreConfig } from '../../interfaces/index.js';

/**
 * Strategy interface for event store setup.
 */
export interface IEventStoreStrategy {
  canHandle(config: EventStoreConfig): boolean;
  invoke(config: EventStoreConfig): Provider[];
}
