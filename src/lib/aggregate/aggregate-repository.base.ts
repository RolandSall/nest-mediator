import { IEvent, IEventBus, IEventStoreRepository, StoredEvent } from '../interfaces/index.js';
import { AggregateRoot } from './aggregate-root.base.js';

/**
 * Base class for aggregate repositories in event sourcing.
 *
 * Repositories handle loading and saving aggregates:
 * - Loading: Replay events from event store to rebuild aggregate state
 * - Saving: Publish uncommitted events via event bus (which persists + dispatches to consumers)
 *
 * Concrete implementations must provide event deserialization logic.
 *
 * @template TAggregate - The aggregate type
 * @template TId - The aggregate's identifier type
 *
 * @example
 * ```typescript
 * @Injectable()
 * class OrderRepository extends AggregateRepository<OrderAggregate, string> {
 *   protected readonly aggregateType = 'Order';
 *
 *   constructor(
 *     @Inject(EVENT_STORE_REPOSITORY) eventStore: IEventStoreRepository,
 *     eventBus: EventBus,
 *   ) {
 *     super(eventStore, eventBus);
 *   }
 *
 *   protected createEmptyAggregate(): OrderAggregate {
 *     return new OrderAggregate();
 *   }
 *
 *   protected deserializeEvent(eventType: string, payload: any): IEvent {
 *     const types = { OrderCreatedEvent, OrderPlacedEvent };
 *     const EventClass = types[eventType];
 *     return Object.assign(Object.create(EventClass.prototype), payload);
 *   }
 * }
 * ```
 */
export abstract class AggregateRepository<
  TAggregate extends AggregateRoot<TId>,
  TId = string
> {
  constructor(
    protected readonly eventStore: IEventStoreRepository,
    protected readonly eventBus: IEventBus,
  ) {}

  /**
   * The aggregate type name.
   * Must match the aggregate's aggregateType property.
   */
  protected abstract readonly aggregateType: string;

  /**
   * Create an empty aggregate instance for hydration.
   */
  protected abstract createEmptyAggregate(): TAggregate;

  /**
   * Deserialize a stored event back to an event instance.
   *
   * @param eventType - The event class name
   * @param payload - The serialized event data
   * @returns The deserialized event
   */
  protected abstract deserializeEvent(
    eventType: string,
    payload: Record<string, unknown>
  ): IEvent;

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

    // Deserialize events
    const events = storedEvents.map((stored) =>
      this.deserializeEvent(stored.eventType, stored.payload)
    );

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
