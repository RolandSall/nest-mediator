import { ICommand } from './command.interface.js';

/**
 * Interface for command handlers
 *
 * @template TCommand - The command type that extends ICommand
 * @template TResult - What `execute` resolves to. Defaults to `void`, so
 * handlers written as `ICommandHandler<MyCommand>` keep returning
 * `Promise<void>` exactly as before.
 *
 * @example
 * ```typescript
 * // Returns nothing — the default, and the recommended shape.
 * class CancelOrderHandler implements ICommandHandler<CancelOrderCommand> {
 *   async execute(command: CancelOrderCommand): Promise<void> { ... }
 * }
 *
 * // Returns the generated id.
 * class PlaceOrderHandler implements ICommandHandler<PlaceOrderCommand, string> {
 *   async execute(command: PlaceOrderCommand): Promise<string> { return orderId; }
 * }
 * ```
 */
export interface ICommandHandler<TCommand extends ICommand, TResult = void> {
  /**
   * Execute the command
   * @param command - The command to execute
   * @returns Promise resolving to TResult (`void` unless declared otherwise)
   */
  execute(command: TCommand): Promise<TResult>;
}
