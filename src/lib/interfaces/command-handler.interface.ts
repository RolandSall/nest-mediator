import { ICommand } from './command.interface.js';

/**
 * Interface for command handlers
 * @template TCommand - The command type that extends ICommand
 */
export interface ICommandHandler<TCommand extends ICommand> {
  /**
   * Execute the command
   * @param command - The command to execute
   * @returns Promise<void>
   */
  execute(command: TCommand): Promise<void>;
}
