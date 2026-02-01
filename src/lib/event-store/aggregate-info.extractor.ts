import { IEvent } from '../interfaces/index.js';
import {
  DOMAIN_EVENT_METADATA,
  DomainEventMetadata,
} from '../decorators/domain-event.decorator.js';

/**
 * Extracted aggregate information from an event
 */
export interface AggregateInfo {
  /**
   * The aggregate type (e.g., 'Order', 'User')
   */
  type: string;

  /**
   * The aggregate ID value
   */
  id: string;
}

/**
 * Extracts aggregate information from events using the @DomainEvent decorator metadata.
 */
export class AggregateInfoExtractor {
  /**
   * Extract aggregate info from an event.
   * Returns null if the event doesn't have @DomainEvent decorator or the ID field is missing.
   *
   * @param event - The event to extract info from
   * @returns The aggregate info or null
   */
  extract(event: IEvent): AggregateInfo | null {
    const metadata = this.getDecoratorMetadata(event);

    if (!metadata) {
      return null;
    }

    const aggregateId = (event as Record<string, unknown>)[metadata.aggregateIdField];

    if (aggregateId === undefined || aggregateId === null) {
      return null;
    }

    return {
      type: metadata.aggregateType,
      id: String(aggregateId),
    };
  }

  /**
   * Get the @DomainEvent decorator metadata from an event.
   *
   * @param event - The event to get metadata from
   * @returns The metadata or null if not decorated
   */
  private getDecoratorMetadata(event: IEvent): DomainEventMetadata | null {
    return Reflect.getMetadata(DOMAIN_EVENT_METADATA, event.constructor) ?? null;
  }
}
