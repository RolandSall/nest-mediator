import { Inject, Logger } from '@nestjs/common';
import { IEvent, IEventBus, IEventStoreRepository, EVENT_STORE_REPOSITORY } from '../interfaces/index.js';
import { AggregateRoot } from './aggregate-root.base.js';
import { AGGREGATE_CLASS_METADATA } from '../decorators/for-aggregate.decorator.js';
import { getEventClassesForAggregate } from '../decorators/domain-event.decorator.js';
import { MediatorBus } from '../services/mediator.bus.js';

/**
 * Base class for aggregate repositories in event sourcing.
 *
 * Repositories handle loading and saving aggregates:
 * - Loading: Replay events from event store to rebuild aggregate state
 * - Saving: Publish uncommitted events via event bus (which persists + dispatches to consumers)
 *
 * Use the `@ForAggregate(AggregateClass)` decorator to eliminate all boilerplate.
 * The decorator + global `@DomainEvent` registry provide:
 * - `aggregateType` — derived from a temporary aggregate instance
 * - `createEmptyAggregate()` — instantiates the aggregate class
 * - `deserializeEvent()` — looks up event classes from the `@DomainEvent` registry
 *
 * @template TAggregate - The aggregate type
 * @template TId - The aggregate's identifier type
 *
 * @example
 * ```typescript
 * @Injectable()
 * @ForAggregate(OrderAggregate)
 * export class OrderRepository extends AggregateRepository<OrderAggregate, string>
 *   implements IOrderRepository {}
 * ```
 */
export abstract class AggregateRepository<
  TAggregate extends AggregateRoot<TId>,
  TId = string
> {
  private readonly logger = new Logger(this.constructor.name);

  @Inject(EVENT_STORE_REPOSITORY)
  protected readonly eventStore!: IEventStoreRepository;

  @Inject(MediatorBus)
  protected readonly eventBus!: IEventBus;

  /**
   * The aggregate type name, derived from the aggregate class metadata.
   * Lazily resolved on first access.
   */
  private _aggregateType?: string;

  protected get aggregateType(): string {
    if (!this._aggregateType) {
      this._aggregateType = this.createEmptyAggregate().aggregateType;
    }
    return this._aggregateType;
  }

  /**
   * Create an empty aggregate instance for hydration.
   * Derived from the `@ForAggregate` decorator metadata.
   * Can be overridden for custom instantiation logic.
   */
  protected createEmptyAggregate(): TAggregate {
    const aggregateClass = Reflect.getMetadata(AGGREGATE_CLASS_METADATA, this.constructor);
    if (!aggregateClass) {
      throw new Error(
        `${this.constructor.name}: Missing @ForAggregate() decorator. ` +
        `Add @ForAggregate(YourAggregate) to your repository class, ` +
        `or override createEmptyAggregate().`
      );
    }
    return new aggregateClass() as TAggregate;
  }

  /**
   * Deserialize a stored event back to an event instance.
   * Uses the global `@DomainEvent` registry to find the event class.
   * Can be overridden for custom deserialization logic.
   *
   * Returns `null` for event types not registered for this aggregate.
   * This is expected — side-effect events (e.g. InventoryReservedEvent)
   * may be stored under the same aggregate ID but are not part of
   * the aggregate's state and should be skipped during hydration.
   *
   * @param eventType - The event class name
   * @param payload - The serialized event data
   * @returns The deserialized event, or null if the event type is not registered
   */
  protected deserializeEvent(
    eventType: string,
    payload: Record<string, unknown>
  ): IEvent | null {
    const eventClasses = getEventClassesForAggregate(this.aggregateType);
    const EventClass = eventClasses.get(eventType);

    if (!EventClass) {
      this.logger.debug(
        `Skipping event type "${eventType}" — not registered for aggregate "${this.aggregateType}"`
      );
      return null;
    }

    return Object.assign(Object.create(EventClass.prototype), payload);
  }

  /**
   * Find an aggregate by its ID.
   * Returns null if the aggregate doesn't exist.
   *
   * @param id - The aggregate ID
   * @returns The hydrated aggregate or null
   */
  async findById(id: TId): Promise<TAggregate | null> {
    const storedEvents = await this.eventStore.getEventsForAggregate(
      this.aggregateType,
      String(id)
    );

    if (storedEvents.length === 0) {
      return null;
    }

    // Deserialize events, filtering out side-effect events not owned by this aggregate
    const events = storedEvents
      .map((stored) => this.deserializeEvent(stored.eventType, stored.payload))
      .filter((event): event is IEvent => event !== null);

    // Create aggregate and replay events
    const aggregate = this.createEmptyAggregate();
    aggregate.loadFromHistory(events);

    return aggregate;
  }

  /**
   * Get an aggregate by its ID.
   * Throws an error if the aggregate doesn't exist.
   *
   * @param id - The aggregate ID
   * @returns The hydrated aggregate
   * @throws Error if aggregate not found
   */
  async getById(id: TId): Promise<TAggregate> {
    const aggregate = await this.findById(id);

    if (!aggregate) {
      throw new Error(`${this.aggregateType} with id ${id} not found`);
    }

    return aggregate;
  }

  /**
   * Save an aggregate by publishing its uncommitted events.
   *
   * Each event is published via the event bus, which:
   * 1. Persists the event to the event store (system phase)
   * 2. Dispatches to critical consumers (sequential, with compensation)
   * 3. Dispatches to non-critical consumers (parallel, fire-and-forget)
   *
   * After all events are successfully published, they are marked as committed.
   *
   * @param aggregate - The aggregate to save
   * @throws Error if any event fails to publish (compensation will run for critical consumers)
   */
  async save(aggregate: TAggregate): Promise<void> {
    const events = aggregate.getUncommittedEvents();

    if (events.length === 0) {
      return; // Nothing to save
    }

    // Publish each event through the event bus
    // This triggers: persistence → critical consumers → non-critical consumers
    for (const event of events) {
      await this.eventBus.publish(event);
    }

    // Mark events as committed after successful publish
    aggregate.markEventsAsCommitted();
  }
}
