import { Logger } from '@nestjs/common';
import { IEvent } from '../interfaces/index.js';

/**
 * Base class for aggregate roots in event sourcing.
 *
 * Aggregates encapsulate domain logic and track uncommitted events.
 * Events are applied to update state and tracked for later persistence.
 *
 * @template TId - The type of the aggregate's identifier
 *
 * @example
 * ```typescript
 * class OrderAggregate extends AggregateRoot<string> {
 *   private _id: string;
 *   private _status: 'draft' | 'placed' = 'draft';
 *
 *   readonly aggregateType = 'Order';
 *   get id() { return this._id; }
 *
 *   static create(orderId: string): OrderAggregate {
 *     const order = new OrderAggregate();
 *     order.apply(new OrderCreatedEvent(orderId));
 *     return order;
 *   }
 *
 *   place(): void {
 *     if (this._status !== 'draft') throw new Error('Order already placed');
 *     this.apply(new OrderPlacedEvent(this._id));
 *   }
 *
 *   // Event handlers
 *   applyOrderCreatedEvent(event: OrderCreatedEvent): void {
 *     this._id = event.orderId;
 *   }
 *
 *   applyOrderPlacedEvent(event: OrderPlacedEvent): void {
 *     this._status = 'placed';
 *   }
 * }
 * ```
 */
export abstract class AggregateRoot<TId = string> {
  private readonly logger = new Logger(this.constructor.name);

  /**
   * Events that have been applied but not yet persisted
   */
  private _uncommittedEvents: IEvent[] = [];

  /**
   * The current version (number of events applied from history)
   */
  private _version: number = 0;

  /**
   * The aggregate's unique identifier.
   * Must be implemented by concrete classes.
   */
  abstract readonly id: TId;

  /**
   * The aggregate type name (e.g., 'Order', 'User').
   * Used for event store partitioning.
   * Must be implemented by concrete classes.
   */
  abstract readonly aggregateType: string;

  /**
   * Get the current version of the aggregate.
   * This is the number of events that have been loaded from history.
   */
  get version(): number {
    return this._version;
  }

  /**
   * Get all events that have been applied but not yet persisted.
   * These should be published after saving the aggregate.
   */
  getUncommittedEvents(): IEvent[] {
    return [...this._uncommittedEvents];
  }

  /**
   * Clear uncommitted events after they have been persisted.
   * Call this after successfully publishing all events.
   */
  markEventsAsCommitted(): void {
    this._uncommittedEvents = [];
  }

  /**
   * Rebuild the aggregate state from historical events.
   * Used when loading an aggregate from the event store.
   *
   * @param events - The events to replay
   */
  loadFromHistory(events: IEvent[]): void {
    for (const event of events) {
      this.applyEvent(event, false);
      this._version++;
    }
  }

  /**
   * Apply a new event to the aggregate.
   * Call this from command methods to record state changes.
   *
   * This method does two things:
   * 1. Calls the matching handler method on your aggregate to update state.
   *    The handler is found by convention: `apply` + event class name.
   *    Example: `apply(new OrderPlacedEvent(...))` calls `this.applyOrderPlacedEvent(event)`.
   * 2. Tracks the event as uncommitted so `AggregateRepository.save()` can publish it.
   *
   * @param event - The event to apply
   */
  protected apply(event: IEvent): void {
    this.applyEvent(event, true);
  }

  /**
   * Apply an event to update state and optionally track it.
   *
   * @param event - The event to apply
   * @param isNew - Whether this is a new event (true) or from history (false)
   */
  private applyEvent(event: IEvent, isNew: boolean): void {
    // Build the handler method name: apply{EventClassName}
    const handlerName = `apply${event.constructor.name}`;
    const handler = (this as Record<string, unknown>)[handlerName];

    if (typeof handler === 'function') {
      handler.call(this, event);
    } else if (isNew) {
      this.logger.warn(
        `${this.constructor.name} is missing "${handlerName}(event: ${event.constructor.name}): void" to apply state changes`,
      );
    }

    if (isNew) {
      this._uncommittedEvents.push(event);
      this._version++;
    }
  }
}
