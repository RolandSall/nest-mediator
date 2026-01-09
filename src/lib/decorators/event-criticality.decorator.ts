import { SetMetadata } from '@nestjs/common';
import {
  EventCriticality,
  EventCriticalityMetadata,
} from '../interfaces/event-criticality.interface.js';

// Re-export types for backward compatibility
export { EventCriticality, EventCriticalityMetadata } from '../interfaces/event-criticality.interface.js';

export const EVENT_CRITICALITY_METADATA = 'EVENT_CRITICALITY_METADATA';

/**
 * Options for critical event handlers
 */
export interface CriticalOptions {
  /**
   * Execution order within critical handlers.
   * Lower numbers execute first.
   * Default: 0
   */
  order?: number;
}

/**
 * Decorator to mark an event handler as critical.
 * Critical handlers:
 * - Run sequentially in the order specified
 * - Must complete before non-critical handlers start
 * - If one fails, the publish operation fails (remaining critical handlers are skipped)
 * - Are awaited by the caller
 *
 * @param options - Optional configuration (order)
 * @returns Class decorator
 *
 * @example
 * ```typescript
 * @EventHandler(OrderPlacedEvent)
 * @Critical({ order: 1 })
 * export class ReserveInventoryHandler implements IEventConsumer<OrderPlacedEvent> {
 *   async handle(event: OrderPlacedEvent): Promise<void> {
 *     await this.inventoryService.reserve(event.items);
 *   }
 * }
 * ```
 */
export const Critical = (options: CriticalOptions = {}): ClassDecorator => {
  const metadata: EventCriticalityMetadata = {
    criticality: EventCriticality.CRITICAL,
    order: options.order ?? 0,
  };
  return SetMetadata(EVENT_CRITICALITY_METADATA, metadata);
};

/**
 * Decorator to explicitly mark an event handler as non-critical.
 * Non-critical handlers:
 * - Run in parallel after all critical handlers complete
 * - Fire and forget (not awaited by the caller)
 * - Failures are logged but don't affect the publish result
 * - Don't block the caller
 *
 * Note: Handlers without @Critical or @NonCritical are non-critical by default.
 *
 * @returns Class decorator
 *
 * @example
 * ```typescript
 * @EventHandler(OrderPlacedEvent)
 * @NonCritical()
 * export class SendOrderConfirmationEmail implements IEventConsumer<OrderPlacedEvent> {
 *   async handle(event: OrderPlacedEvent): Promise<void> {
 *     await this.emailService.send(event.customerEmail, 'order_confirmed');
 *   }
 * }
 * ```
 */
export const NonCritical = (): ClassDecorator => {
  const metadata: EventCriticalityMetadata = {
    criticality: EventCriticality.NON_CRITICAL,
    order: 0,
  };
  return SetMetadata(EVENT_CRITICALITY_METADATA, metadata);
};
