import { Injectable, Logger, Optional, Type } from '@nestjs/common';
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
import { mediatorContext } from '../context';
import { v4 as uuidv4 } from 'uuid';
import { StepEmitter } from '../mediator-flow/step-emitter.js';
import { StepType } from '../mediator-flow/protocol.js';
import { AggregateInfoExtractor } from '../event-store/aggregate-info.extractor.js';

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
 * System consumer that runs before user consumers (e.g., event store persistence)
 */
interface SystemConsumer {
  instance: IEventConsumer<IEvent>;
  name: string;
}

/**
 * Event bus implementation.
 * Publishes events to their consumers with critical/non-critical handling.
 * Supports saga-style compensation for critical consumers.
 * Includes system phase for internal consumers (e.g., event store persistence).
 */
@Injectable()
export class EventBus implements IEventBus {
  private readonly logger = new Logger('EventBus');
  private readonly handlers = new Map<string, RegisteredEventConsumer[]>();
  private readonly aggregateInfoExtractor = new AggregateInfoExtractor();

  /**
   * System consumers run before all user consumers.
   * Used internally for event store persistence.
   */
  private readonly systemConsumers: SystemConsumer[] = [];

  constructor(
    private readonly moduleRef: ModuleRef,
    @Optional() private readonly stepEmitter?: StepEmitter,
  ) {}

  /**
   * Register a system consumer (internal use only).
   * System consumers run before all user-defined consumers.
   *
   * @param consumer - The consumer instance
   * @param name - A name for logging purposes
   */
  registerSystemConsumer(
    consumer: IEventConsumer<IEvent>,
    name: string = consumer.constructor.name
  ): void {
    this.systemConsumers.push({ instance: consumer, name });
    this.logger.log(`Registered system consumer: ${name}`);
  }

  /**
   * Publish an event to all its consumers
   */
  async publish<TEvent extends IEvent>(event: TEvent): Promise<EventPublishResult> {
    const eventId = uuidv4();
    const eventName = event.constructor.name;

    // Run within causation context
    return mediatorContext.runWithCausation(eventId, async () => {
      const consumers = this.handlers.get(eventName) || [];

      const hasConsumers = consumers.length > 0 || this.systemConsumers.length > 0;

      if (!hasConsumers) {
        this.logger.log(`No consumers registered for event: ${eventName}`);
        return {
          totalHandlers: 0,
          criticalSucceeded: 0,
          nonCriticalDispatched: 0,
          compensationsRun: 0,
        };
      }

      // Emit EVENT_PUBLISHED step with aggregate metadata
      if (this.stepEmitter?.enabled) {
        const aggInfo = this.aggregateInfoExtractor.extract(event);
        this.stepEmitter.emit(StepType.EVENT_PUBLISHED, eventName, {
          eventId,
          metadata: aggInfo
            ? { aggregateType: aggInfo.type, aggregateId: aggInfo.id }
            : undefined,
        });
      }

      // Separate critical and non-critical consumers
      const criticalConsumers = consumers
        .filter((h) => h.criticality === EventCriticality.CRITICAL)
        .sort((a, b) => a.order - b.order);

      const nonCriticalConsumers = consumers.filter(
        (h) => h.criticality === EventCriticality.NON_CRITICAL
      );

      this.logger.log(
        `Publishing event: ${eventName} to ${this.systemConsumers.length} system, ` +
          `${criticalConsumers.length} critical, and ${nonCriticalConsumers.length} non-critical consumers`
      );

      // Track succeeded consumers for compensation
      const succeededWithCompensation: CompensatableConsumer<TEvent>[] = [];
      let criticalSucceeded = 0;

      try {
        // ========================================
        // SYSTEM PHASE (event store persistence)
        // ========================================
        for (const systemConsumer of this.systemConsumers) {
          try {
            if (this.stepEmitter?.enabled) {
              await this.stepEmitter.wrapAsync(
                StepType.SYSTEM_CONSUMER_STARTED,
                StepType.SYSTEM_CONSUMER_COMPLETED,
                StepType.SYSTEM_CONSUMER_FAILED,
                systemConsumer.name,
                () => systemConsumer.instance.handle(event),
                { eventId },
              );
            } else {
              await systemConsumer.instance.handle(event);
            }
            this.logger.log(`System consumer ${systemConsumer.name} completed successfully`);
          } catch (error) {
            this.logger.error(
              `System consumer ${systemConsumer.name} failed: ${(error as Error).message}`
            );
            // System consumers don't have compensation - just fail
            throw error;
          }
        }

        // ========================================
        // USER PHASE - Critical consumers
        // ========================================
        for (const registeredConsumer of criticalConsumers) {
          const consumer = this.moduleRef.get<ICriticalEventConsumer<TEvent>>(
            registeredConsumer.type,
            { strict: false }
          );

          try {
            if (this.stepEmitter?.enabled) {
              await this.stepEmitter.wrapAsync(
                StepType.CRITICAL_CONSUMER_STARTED,
                StepType.CRITICAL_CONSUMER_COMPLETED,
                StepType.CRITICAL_CONSUMER_FAILED,
                registeredConsumer.type.name,
                () => consumer.handle(event),
                { eventId },
              );
            } else {
              await consumer.handle(event);
            }
            criticalSucceeded++;
            this.logger.log(
              `Critical consumer ${registeredConsumer.type.name} completed successfully`
            );

            // Track if it has a compensation method for potential rollback
            if (
              'applyCompensatingEvent' in consumer ||
              'compensate' in consumer
            ) {
              succeededWithCompensation.push({
                consumer,
                name: registeredConsumer.type.name,
              });
            }
          } catch (error) {
            this.logger.error(
              `Critical consumer ${registeredConsumer.type.name} failed: ${(error as Error).message}`
            );

            // Run compensations for user consumers (in reverse order)
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

        // ========================================
        // USER PHASE - Non-critical consumers
        // ========================================
        let nonCriticalDispatched = 0;
        for (const registeredConsumer of nonCriticalConsumers) {
          nonCriticalDispatched++;
          this.stepEmitter?.emit(
            StepType.NONCRITICAL_CONSUMER_DISPATCHED,
            registeredConsumer.type.name,
            { eventId },
          );
          this.executeNonCriticalConsumer(event, registeredConsumer, eventId);
        }

        return {
          totalHandlers: consumers.length,
          criticalSucceeded,
          nonCriticalDispatched,
          compensationsRun: 0,
        };
      } catch (error) {
        throw error;
      }
    });
  }

  /**
   * Run compensations for succeeded consumers in reverse order.
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
        this.stepEmitter?.emit(StepType.COMPENSATION_STARTED, name);

        // Prefer applyCompensatingEvent (recommended) over compensate (deprecated)
        if (consumer.applyCompensatingEvent) {
          const compensatingEvent = await consumer.applyCompensatingEvent(event);
          compensationsRun++;

          this.stepEmitter?.emit(StepType.COMPENSATION_COMPLETED, name);

          this.logger.log(
            `Publishing compensating event: ${compensatingEvent.constructor.name} from ${name}`
          );
          this.stepEmitter?.emit(
            StepType.COMPENSATING_EVENT_PUBLISHED,
            compensatingEvent.constructor.name,
            { metadata: { sourceName: name } },
          );
          await this.publish(compensatingEvent);
        } else if (consumer.compensate) {
          // Deprecated path
          this.logger.warn(
            `${name} uses deprecated compensate() method. ` +
              `Migrate to applyCompensatingEvent() which returns a compensating event.`
          );
          await consumer.compensate(event);
          compensationsRun++;
          this.stepEmitter?.emit(StepType.COMPENSATION_COMPLETED, name);
        }

        this.logger.log(`Compensation for ${name} completed successfully`);
      } catch (compError) {
        // Log but continue with other compensations
        this.logger.error(
          `Compensation for ${name} failed: ${(compError as Error).message}. ` +
            `Manual intervention may be required.`
        );
        this.stepEmitter?.emit(StepType.COMPENSATION_FAILED, name, {
          error: (compError as Error).message,
        });
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
   * Get detailed event registrations with compensation info (for MediatorFlow topology)
   */
  getRegisteredEventsDetailed(): {
    eventName: string;
    consumers: {
      consumerName: string;
      criticality: string;
      order: number;
      hasCompensation: boolean;
    }[];
  }[] {
    return Array.from(this.handlers.entries()).map(([eventName, consumers]) => ({
      eventName,
      consumers: consumers.map((h) => {
        let hasCompensation = false;
        try {
          const instance = this.moduleRef.get(h.type, { strict: false });
          hasCompensation =
            'applyCompensatingEvent' in instance || 'compensate' in instance;
        } catch {
          // Consumer may not be instantiated yet
        }
        return {
          consumerName: h.type.name,
          criticality: h.criticality,
          order: h.order,
          hasCompensation,
        };
      }),
    }));
  }

  /**
   * Execute a non-critical consumer in the background
   */
  private executeNonCriticalConsumer<TEvent extends IEvent>(
    event: TEvent,
    registeredConsumer: RegisteredEventConsumer,
    eventId?: string,
  ): void {
    // Capture context before setImmediate (async context may be lost)
    const ctx = mediatorContext.getContext();
    const emitter = this.stepEmitter;

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
        if (emitter?.enabled) {
          emitter.emit(StepType.NONCRITICAL_CONSUMER_COMPLETED, registeredConsumer.type.name, {
            eventId,
          });
        }
      } catch (error) {
        this.logger.warn(
          `Non-critical consumer ${registeredConsumer.type.name} failed: ${(error as Error).message}`
        );
        if (emitter?.enabled) {
          emitter.emit(StepType.NONCRITICAL_CONSUMER_FAILED, registeredConsumer.type.name, {
            eventId,
            error: (error as Error).message,
          });
        }
      }
    });
  }
}
