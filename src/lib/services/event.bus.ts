import { Injectable, Logger, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  IEvent,
  IEventConsumer,
  ICriticalEventConsumer,
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
 * Tracks a succeeded critical consumer for potential compensation
 */
interface CompensatableConsumer<TEvent extends IEvent> {
  consumer: ICriticalEventConsumer<TEvent>;
  name: string;
}

/**
 * Event bus implementation.
 * Publishes events to their consumers with critical/non-critical handling.
 * Supports saga-style compensation for critical consumers.
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
   * 2. If a critical consumer fails:
   *    - Compensations run in reverse order for previously succeeded consumers
   *    - Non-critical consumers are NOT dispatched
   *    - Original error is thrown after compensations complete
   * 3. If all critical consumers succeed, non-critical consumers are fired in parallel (fire-and-forget)
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
        compensationsRun: 0,
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

    // Phase 1: Execute critical consumers sequentially, tracking those with compensate()
    const succeededWithCompensation: CompensatableConsumer<TEvent>[] = [];
    let criticalSucceeded = 0;

    for (const registeredConsumer of criticalConsumers) {
      const consumer = this.moduleRef.get<ICriticalEventConsumer<TEvent>>(
        registeredConsumer.type,
        { strict: false }
      );

      try {
        await consumer.handle(event);
        criticalSucceeded++;
        this.logger.log(
          `Critical consumer ${registeredConsumer.type.name} completed successfully`
        );

        // Track if it has a compensate method for potential rollback
        if (typeof consumer.compensate === 'function') {
          succeededWithCompensation.push({
            consumer,
            name: registeredConsumer.type.name,
          });
        }
      } catch (error) {
        this.logger.error(
          `Critical consumer ${registeredConsumer.type.name} failed: ${(error as Error).message}`
        );

        // Run compensations for previously succeeded consumers (in reverse order)
        const compensationsRun = await this.runCompensations(
          succeededWithCompensation,
          event
        );

        this.logger.log(
          `Ran ${compensationsRun} compensations after failure in ${registeredConsumer.type.name}`
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
      compensationsRun: 0,
    };
  }

  /**
   * Run compensations for succeeded consumers in reverse order
   * Continues even if individual compensations fail (logs errors)
   *
   * @param succeededConsumers - Consumers that succeeded and have compensate()
   * @param event - The event to pass to compensate()
   * @returns Number of compensations that were run
   */
  private async runCompensations<TEvent extends IEvent>(
    succeededConsumers: CompensatableConsumer<TEvent>[],
    event: TEvent
  ): Promise<number> {
    let compensationsRun = 0;

    // Run in reverse order (last succeeded -> first succeeded)
    for (const { consumer, name } of succeededConsumers.reverse()) {
      try {
        this.logger.log(`Running compensation for ${name}...`);
        await consumer.compensate!(event);
        compensationsRun++;
        this.logger.log(`Compensation for ${name} completed successfully`);
      } catch (compError) {
        // Log but continue with other compensations
        this.logger.error(
          `Compensation for ${name} failed: ${(compError as Error).message}. ` +
            `Manual intervention may be required.`
        );
        compensationsRun++; // Count as run even if failed
      }
    }

    return compensationsRun;
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
