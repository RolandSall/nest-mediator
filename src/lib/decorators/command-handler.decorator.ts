import { SetMetadata } from '@nestjs/common';
import { ICommand } from '../interfaces/index.js';

export const COMMAND_HANDLER_METADATA = 'COMMAND_HANDLER_METADATA';

/**
 * Decorator to mark a class as a command handler
 * @param command - The command class that this handler handles
 * @returns Class decorator
 *
 * @example
 * ```typescript
 * @CommandHandler(AddCategoryCommand)
 * export class AddCategoryCommandHandler implements ICommandHandler<AddCategoryCommand> {
 *   async execute(command: AddCategoryCommand): Promise<Category> {
 *     // Implementation
 *   }
 * }
 * ```
 */
export const CommandHandler = (command: new (...args: any[]) => ICommand): ClassDecorator => {
  return SetMetadata(COMMAND_HANDLER_METADATA, command);
};
