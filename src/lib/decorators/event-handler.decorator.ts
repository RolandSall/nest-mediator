import { SetMetadata } from '@nestjs/common';
import { IEvent } from '../interfaces/index.js';

export const EVENT_HANDLER_METADATA = 'EVENT_HANDLER_METADATA';

/**
 * Decorator to mark a class as an event consumer.
 * Multiple consumers can subscribe to the same event.
 *
 * @param event - The event class that this consumer handles
 * @returns Class decorator
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
export const EventHandler = (
  event: new (...args: any[]) => IEvent
): ClassDecorator => {
  return SetMetadata(EVENT_HANDLER_METADATA, event);
};
