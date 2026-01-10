import { IEvent } from './event.interface.js';

/**
 * Interface for event consumers.
 * Event consumers subscribe to events and react to them.
 * Multiple consumers can subscribe to the same event.
 *
 * Use this interface for non-critical consumers (fire-and-forget).
 *
 * @example
 * ```typescript
 * @EventHandler(UserCreatedEvent)
 * @NonCritical()
 * export class SendWelcomeEmailConsumer implements IEventConsumer<UserCreatedEvent> {
 *   async handle(event: UserCreatedEvent): Promise<void> {
 *     await this.emailService.sendWelcome(event.userEmail);
 *   }
 * }
 * ```
 */
export interface IEventConsumer<TEvent extends IEvent> {
  /**
   * Handle the event
   * @param event - The event instance
   */
  handle(event: TEvent): Promise<void>;
}

/**
 * Interface for critical event consumers with optional compensation.
 * Critical consumers run sequentially and can define a compensate method
 * that will be called if a subsequent critical consumer fails.
 *
 * Compensation is called in reverse order (last succeeded -> first succeeded)
 * when a critical consumer in the chain fails.
 *
 * @example
 * ```typescript
 * @EventHandler(OrderPlacedEvent)
 * @Critical({ order: 2 })
 * export class ReserveInventoryConsumer implements ICriticalEventConsumer<OrderPlacedEvent> {
 *   async handle(event: OrderPlacedEvent): Promise<void> {
 *     await this.inventoryService.reserve(event.orderId, event.items);
 *   }
 *
 *   async compensate(event: OrderPlacedEvent): Promise<void> {
 *     await this.inventoryService.releaseByOrderId(event.orderId);
 *   }
 * }
 * ```
 */
export interface ICriticalEventConsumer<TEvent extends IEvent> extends IEventConsumer<TEvent> {
  /**
   * Compensate/rollback the work done by handle().
   * Called when a subsequent critical consumer fails.
   * Should be idempotent and derive state from the event.
   *
   * @param event - The same event instance passed to handle()
   */
  compensate?(event: TEvent): Promise<void>;
}

/**
 * @deprecated Use IEventConsumer instead
 */
export type IEventHandler<TEvent extends IEvent> = IEventConsumer<TEvent>;
