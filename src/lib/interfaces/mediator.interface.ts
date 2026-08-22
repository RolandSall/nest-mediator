import { ICommandBus } from './command-bus.interface.js';
import { ICommand } from './command.interface.js';
import { IQueryBus } from './query-bus.interface.js';
import { IEventBus } from './event-bus.interface.js';

/**
 * Unified mediator interface combining command, query, and event bus capabilities.
 * This is the primary interface clients should depend on.
 */
export interface IMediator extends ICommandBus, IQueryBus, IEventBus {
  /**
   * Preserve the original command call form, including an explicitly supplied
   * command type, and resolve to `void`.
   */
  send<TCommand extends ICommand>(command: TCommand): Promise<void>;

  /**
   * Send a command whose handler returns `TResult`.
   */
  send<TResult, TCommand extends ICommand = ICommand>(
    command: TCommand
  ): Promise<TResult>;

  /**
   * Get registered behavior names (for debugging)
   */
  getRegisteredBehaviors(): string[];
}
