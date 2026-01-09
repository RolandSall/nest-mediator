import { Type } from '@nestjs/common';
import { ICommand } from './command.interface.js';
import { ICommandHandler } from './command-handler.interface.js';

/**
 * Interface for the command bus.
 * Responsible for dispatching commands to their handlers.
 */
export interface ICommandBus {
  /**
   * Send a command to its handler
   * @param command - The command instance
   */
  send<TCommand extends ICommand>(command: TCommand): Promise<void>;

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
