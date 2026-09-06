import { v4 as uuidv4 } from 'uuid';
import { mediatorContext } from '../context/mediator-context.js';
import { IEvent, StoredEvent } from '../interfaces/index.js';
import { AggregateInfoExtractor } from './aggregate-info.extractor.js';

/**
 * Creates the immutable representation persisted by an event-store repository.
 * Kept internal so regular publication and atomic aggregate saving use identical
 * serialization and correlation metadata.
 */
export class StoredEventFactory {
  private readonly extractor = new AggregateInfoExtractor();

  create(
    event: IEvent,
    eventId: string = uuidv4(),
    causationId?: string,
  ): StoredEvent {
    const context = mediatorContext.getContext();
    const aggregateInfo = this.extractor.extract(event);

    return {
      eventId,
      eventType: event.constructor.name,
      payload: this.serializeEvent(event),
      occurredAt: this.getEventTimestamp(event),
      storedAt: new Date(),
      correlationId: context.correlationId,
      causationId: causationId ?? context.causationId,
      metadata: {},
      aggregateType: aggregateInfo?.type,
      aggregateId: aggregateInfo?.id,
      sequenceNumber: undefined,
    };
  }

  private serializeEvent(event: IEvent): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    for (const key of Object.keys(event)) {
      payload[key] = (event as Record<string, unknown>)[key];
    }
    return payload;
  }

  private getEventTimestamp(event: IEvent): Date {
    const eventWithTimestamp = event as { occurredAt?: Date };
    return eventWithTimestamp.occurredAt instanceof Date
      ? eventWithTimestamp.occurredAt
      : new Date();
  }
}
