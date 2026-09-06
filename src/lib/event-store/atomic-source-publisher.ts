import { Inject, Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { AggregateRoot } from '../aggregate/aggregate-root.base.js';
import { mediatorContext } from '../context/mediator-context.js';
import {
  EVENT_STORE_REPOSITORY,
  IEvent,
  IEventStoreRepository,
  StoredEvent,
} from '../interfaces/index.js';
import { EventBus } from '../services/event.bus.js';
import { StoredEventFactory } from './stored-event.factory.js';

interface PreparedEvent {
  event: IEvent;
  eventId: string;
  storedEvent: StoredEvent;
}

/**
 * Internal coordinator for opt-in atomic aggregate saves in source mode.
 * The event-store repository owns the database transaction. This coordinator
 * only defines the ordering around that transaction.
 */
@Injectable()
export class AtomicSourcePublisher {
  private readonly storedEventFactory = new StoredEventFactory();

  constructor(
    @Inject(EVENT_STORE_REPOSITORY)
    private readonly repository: IEventStoreRepository,
    private readonly eventBus: EventBus,
  ) {}

  async save<TId>(aggregate: AggregateRoot<TId>): Promise<void> {
    await this.runInMediatorContext(() => this.persistAndDispatch(aggregate));
  }

  private runInMediatorContext(operation: () => Promise<void>): Promise<void> {
    return mediatorContext.hasContext()
      ? operation()
      : mediatorContext.runWithNewContext(operation);
  }

  private async persistAndDispatch<TId>(
    aggregate: AggregateRoot<TId>,
  ): Promise<void> {
    const events = aggregate.getUncommittedEvents();
    if (events.length === 0) {
      return;
    }

    const preparedEvents = this.prepareEvents(events);
    const expectedVersion = aggregate.version - events.length;

    await this.repository.appendEvents(
      aggregate.aggregateType,
      String(aggregate.id),
      preparedEvents.map(({ storedEvent }) => storedEvent),
      expectedVersion,
    );

    aggregate.markEventsAsCommitted();
    await this.dispatchPersistedEvents(preparedEvents);
  }

  private prepareEvents(events: IEvent[]): PreparedEvent[] {
    const parentEventId = mediatorContext.getContext().currentEventId;

    return events.map((event) => {
      const eventId = uuidv4();
      return {
        event,
        eventId,
        storedEvent: this.storedEventFactory.create(
          event,
          eventId,
          parentEventId,
        ),
      };
    });
  }

  private async dispatchPersistedEvents(
    events: PreparedEvent[],
  ): Promise<void> {
    for (const { event, eventId } of events) {
      await this.eventBus.publishPersisted(event, eventId);
    }
  }
}
