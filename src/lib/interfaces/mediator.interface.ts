import { ICommandBus } from './command-bus.interface.js';
import { IQueryBus } from './query-bus.interface.js';
import { IEventBus } from './event-bus.interface.js';

/**
 * Unified mediator interface combining command, query, and event bus capabilities.
 * This is the primary interface clients should depend on.
 */
export interface IMediator extends ICommandBus, IQueryBus, IEventBus {
  /**
   * Get registered behavior names (for debugging)
   */
  getRegisteredBehaviors(): string[];
}
