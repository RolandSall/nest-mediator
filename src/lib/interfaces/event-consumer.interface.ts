import { IEvent } from './event.interface.js';

/**
 * Interface for event consumers.
 * Event consumers subscribe to events and react to them.
 * Multiple consumers can subscribe to the same event.
 *
 * @example
 * ```typescript
 * @EventHandler(UserCreatedEvent)
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
 * @deprecated Use IEventConsumer instead
 */
export type IEventHandler<TEvent extends IEvent> = IEventConsumer<TEvent>;
