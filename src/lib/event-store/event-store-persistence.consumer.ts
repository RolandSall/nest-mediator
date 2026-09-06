import { IEvent, IEventConsumer } from '../interfaces/index.js';
import {
  IEventStoreRepository,
  StoredEvent,
  EventStoreConfig,
} from '../interfaces/event-store.interface.js';
import { AggregateInfoExtractor } from './aggregate-info.extractor.js';
import { mediatorContext } from '../context/mediator-context.js';
import { StoredEventFactory } from './stored-event.factory.js';

/**
 * Internal system consumer that persists events to the database.
 * Runs before all user-defined consumers (system phase).
 *
 * This consumer is NOT exposed to users - it's registered internally by the module.
 *
 * Events are immutable - once stored, they are never modified or deleted.
 * Compensation is handled by emitting new compensating events, not by
 * modifying existing ones.
 *
 * This remains a 1.x compatibility component. The planned 2.0 design replaces
 * it with an audit-only consumer and makes AggregateRepository.save() the sole
 * source-mode persistence entry point.
 */
export class EventStorePersistenceConsumer implements IEventConsumer<IEvent> {
  private readonly extractor = new AggregateInfoExtractor();
  private readonly storedEventFactory = new StoredEventFactory();

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
    const context = mediatorContext.getContext();
    const aggregateInfo = this.extractor.extract(event);
    const storedEvent: StoredEvent = this.storedEventFactory.create(
      event,
      context.currentEventId,
    );

    // Determine save strategy based on mode and aggregate info
    if (this.config.mode === 'source' && aggregateInfo) {
      // Compatibility path: append one published aggregate event.
      const nextSequence = await this.repository.getNextSequence(
        aggregateInfo.type,
        aggregateInfo.id
      );
      storedEvent.sequenceNumber = nextSequence;

      await this.repository.appendEvents(
        aggregateInfo.type,
        aggregateInfo.id,
        [storedEvent],
        nextSequence - 1
      );
    } else {
      // Audit mode OR no aggregate info - simple save
      await this.repository.saveEvent(storedEvent);
    }
  }
}
