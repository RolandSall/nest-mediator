import { Injectable, Logger, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  IEvent,
  IEventConsumer,
  IEventBus,
  EventPublishResult,
  EventCriticalityMetadata,
  EventCriticality,
} from '../interfaces/index.js';

/**
 * Registered event consumer with its criticality metadata
 */
interface RegisteredEventConsumer {
  type: Type<IEventConsumer<any>>;
  criticality: EventCriticality;
  order: number;
}

/**
 * Event bus implementation.
 * Publishes events to their consumers with critical/non-critical handling.
 */
@Injectable()
export class EventBus implements IEventBus {
  private readonly logger = new Logger('EventBus');
  private readonly handlers = new Map<string, RegisteredEventConsumer[]>();

  constructor(private readonly moduleRef: ModuleRef) {}

  /**
   * Publish an event to all its consumers
   *
   * Execution flow:
   * 1. Critical consumers run sequentially in order (lower order first)
   * 2. If all critical consumers succeed, non-critical consumers are fired in parallel (fire-and-forget)
   * 3. If a critical consumer fails, remaining critical consumers are skipped and non-critical consumers don't run
   *
   * @param event - The event instance
   * @returns Promise with the publish result
   */
  async publish<TEvent extends IEvent>(event: TEvent): Promise<EventPublishResult> {
    const eventName = event.constructor.name;
    const consumers = this.handlers.get(eventName) || [];

    if (consumers.length === 0) {
      this.logger.log(`No consumers registered for event: ${eventName}`);
      return {
        totalHandlers: 0,
        criticalSucceeded: 0,
        nonCriticalDispatched: 0,
      };
    }

    // Separate critical and non-critical consumers
    const criticalConsumers = consumers
      .filter((h) => h.criticality === EventCriticality.CRITICAL)
      .sort((a, b) => a.order - b.order);

    const nonCriticalConsumers = consumers.filter(
      (h) => h.criticality === EventCriticality.NON_CRITICAL
    );

    this.logger.log(
      `Publishing event: ${eventName} to ${criticalConsumers.length} critical and ${nonCriticalConsumers.length} non-critical consumers`
    );

    // Phase 1: Execute critical consumers sequentially
    let criticalSucceeded = 0;
    for (const registeredConsumer of criticalConsumers) {
      const consumer = this.moduleRef.get<IEventConsumer<TEvent>>(
        registeredConsumer.type,
        { strict: false }
      );

      try {
        await consumer.handle(event);
        criticalSucceeded++;
        this.logger.log(
          `Critical consumer ${registeredConsumer.type.name} completed successfully`
        );
      } catch (error) {
        this.logger.error(
          `Critical consumer ${registeredConsumer.type.name} failed: ${(error as Error).message}`
        );
        throw error;
      }
    }

    // Phase 2: Fire non-critical consumers in parallel (fire-and-forget)
    let nonCriticalDispatched = 0;
    for (const registeredConsumer of nonCriticalConsumers) {
      nonCriticalDispatched++;
      this.executeNonCriticalConsumer(event, registeredConsumer);
    }

    return {
      totalHandlers: consumers.length,
      criticalSucceeded,
      nonCriticalDispatched,
    };
  }

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
  ): void {
    const eventName = event.name;
    const consumers = this.handlers.get(eventName) || [];

    const registeredConsumer: RegisteredEventConsumer = {
      type: handler,
      criticality: criticalityMetadata?.criticality ?? EventCriticality.NON_CRITICAL,
      order: criticalityMetadata?.order ?? 0,
    };

    consumers.push(registeredConsumer);
    this.handlers.set(eventName, consumers);

    this.logger.log(
      `Registered event consumer: ${handler.name} for event: ${eventName} (criticality: ${registeredConsumer.criticality}, order: ${registeredConsumer.order})`
    );
  }

  /**
   * Get registered events and their consumers (for debugging)
   */
  getRegisteredEvents(): {
    event: string;
    handlers: { name: string; criticality: string; order: number }[];
  }[] {
    return Array.from(this.handlers.entries()).map(([event, consumers]) => ({
      event,
      handlers: consumers.map((h) => ({
        name: h.type.name,
        criticality: h.criticality,
        order: h.order,
      })),
    }));
  }

  /**
   * Execute a non-critical consumer in the background
   */
  private executeNonCriticalConsumer<TEvent extends IEvent>(
    event: TEvent,
    registeredConsumer: RegisteredEventConsumer
  ): void {
    setImmediate(async () => {
      try {
        const consumer = this.moduleRef.get<IEventConsumer<TEvent>>(
          registeredConsumer.type,
          { strict: false }
        );
        await consumer.handle(event);
        this.logger.log(
          `Non-critical consumer ${registeredConsumer.type.name} completed successfully`
        );
      } catch (error) {
        this.logger.warn(
          `Non-critical consumer ${registeredConsumer.type.name} failed: ${(error as Error).message}`
        );
      }
    });
  }
}
