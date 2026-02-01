import { v4 as uuidv4 } from 'uuid';
import { IEvent, IEventConsumer } from '../interfaces/index.js';
import {
  IEventStoreRepository,
  StoredEvent,
  EventStoreConfig,
} from '../interfaces/event-store.interface.js';
import { AggregateInfoExtractor } from './aggregate-info.extractor.js';
import { mediatorContext } from '../context/mediator-context.js';

/**
 * Internal system consumer that persists events to the database.
 * Runs before all user-defined consumers (system phase).
 *
 * This consumer is NOT exposed to users - it's registered internally by the module.
 *
 * Events are immutable - once stored, they are never modified or deleted.
 * Compensation is handled by emitting new compensating events, not by
 * modifying existing ones.
 */
export class EventStorePersistenceConsumer implements IEventConsumer<IEvent> {
  private readonly extractor = new AggregateInfoExtractor();

  constructor(
    private readonly repository: IEventStoreRepository,
    private readonly config: EventStoreConfig
  ) {}

  /**
   * Handle event persistence before user consumers run.
   *
   * @param event - The event to persist
   */
  async handle(event: IEvent): Promise<void> {
    const eventId = uuidv4();
    const context = mediatorContext.getContext();
    const aggregateInfo = this.extractor.extract(event);

    const storedEvent: StoredEvent = {
      eventId,
      eventType: event.constructor.name,
      payload: this.serializeEvent(event),
      occurredAt: this.getEventTimestamp(event),
      storedAt: new Date(),
      correlationId: context.correlationId,
      causationId: context.causationId,
      metadata: {},
      aggregateType: aggregateInfo?.type,
      aggregateId: aggregateInfo?.id,
      sequenceNumber: undefined,
    };

    // Determine save strategy based on mode and aggregate info
    if (this.config.mode === 'source' && aggregateInfo) {
      // Source mode with aggregate - use append with concurrency check
      const currentVersion = await this.repository.getNextSequence(
        aggregateInfo.type,
        aggregateInfo.id
      );
      storedEvent.sequenceNumber = currentVersion;

      await this.repository.appendEvents(
        aggregateInfo.type,
        aggregateInfo.id,
        [storedEvent],
        currentVersion - 1
      );
    } else {
      // Audit mode OR no aggregate info - simple save
      await this.repository.saveEvent(storedEvent);
    }
  }

  /**
   * Serialize the event to a plain object for storage.
   */
  private serializeEvent(event: IEvent): Record<string, unknown> {
    // Get all own properties of the event
    const payload: Record<string, unknown> = {};
    for (const key of Object.keys(event)) {
      payload[key] = (event as Record<string, unknown>)[key];
    }
    return payload;
  }

  /**
   * Get the event timestamp, using occurredAt if present.
   */
  private getEventTimestamp(event: IEvent): Date {
    const eventWithTimestamp = event as { occurredAt?: Date };
    return eventWithTimestamp.occurredAt instanceof Date
      ? eventWithTimestamp.occurredAt
      : new Date();
  }
}
