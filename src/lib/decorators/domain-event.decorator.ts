import 'reflect-metadata';

/**
 * Metadata key for domain event decorator
 */
export const DOMAIN_EVENT_METADATA = Symbol('DOMAIN_EVENT_METADATA');

/**
 * Metadata stored by the @DomainEvent decorator
 */
export interface DomainEventMetadata {
  /**
   * The aggregate type this event belongs to (e.g., 'Order', 'User')
   */
  aggregateType: string;

  /**
   * The field name in the event that contains the aggregate ID (e.g., 'orderId')
   */
  aggregateIdField: string;
}

/**
 * Decorator that marks an event as belonging to an aggregate.
 * Used for event sourcing to track which aggregate an event belongs to.
 *
 * @param aggregateType - The aggregate type (e.g., 'Order', 'User')
 * @param aggregateIdField - The field name containing the aggregate ID (e.g., 'orderId')
 *
 * @example
 * ```typescript
 * @DomainEvent('Order', 'orderId')
 * export class OrderPlacedEvent implements IEvent {
 *   constructor(
 *     public readonly orderId: string,
 *     public readonly totalAmount: number,
 *   ) {}
 * }
 * ```
 */
export function DomainEvent(
  aggregateType: string,
  aggregateIdField: string
): ClassDecorator {
  return (target: Function) => {
    const metadata: DomainEventMetadata = {
      aggregateType,
      aggregateIdField,
    };
    Reflect.defineMetadata(DOMAIN_EVENT_METADATA, metadata, target);
  };
}
