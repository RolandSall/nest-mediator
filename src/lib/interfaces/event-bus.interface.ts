import { Type } from '@nestjs/common';
import { IEvent, EventPublishResult } from './event.interface.js';
import { IEventConsumer } from './event-consumer.interface.js';
import { EventCriticalityMetadata } from './event-criticality.interface.js';

/**
 * Interface for the event bus.
 * Responsible for publishing events to their consumers.
 */
export interface IEventBus {
  /**
   * Publish an event to all its consumers
   * @param event - The event instance
   * @returns Promise with the publish result
   */
  publish<TEvent extends IEvent>(event: TEvent): Promise<EventPublishResult>;

  /**
   * Register an event consumer
   * @param event - The event class
   * @param handler - The consumer class
   * @param criticalityMetadata - Criticality metadata
   */
  registerEventHandler(
    event: Type<IEvent>,
    handler: Type<IEventConsumer<any>>,
    criticalityMetadata?: EventCriticalityMetadata
  ): void;

  /**
   * Get registered events and their consumers (for debugging)
   */
  getRegisteredEvents(): {
    event: string;
    handlers: { name: string; criticality: string; order: number }[];
  }[];
}
