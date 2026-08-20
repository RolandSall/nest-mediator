import { Type } from '@nestjs/common';
import { ICommand } from './command.interface.js';
import { ICommandHandler } from './command-handler.interface.js';

/**
 * Interface for the command bus.
 * Responsible for dispatching commands to their handlers.
 */
export interface ICommandBus {
  /**
   * Send a command to its handler.
   *
   * `TResult` is inferred from the command type, so callers never write type
   * arguments. A command declared as `ICommand` (the default) resolves to
   * `Promise<void>` exactly as before; a command declared as `ICommand<string>`
   * resolves to `Promise<string>`.
   *
   * @param command - The command instance
   */
  send<TResult = void>(command: ICommand): Promise<TResult>;

  /**
   * Register a command handler
   * @param command - The command class
   * @param handler - The handler class
   */
  registerCommandHandler(
    command: Type<ICommand>,
    handler: Type<ICommandHandler<any>>
  ): void;

  /**
   * Get registered command names (for debugging)
   */
  getRegisteredCommands(): string[];
}
