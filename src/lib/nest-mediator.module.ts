import { DynamicModule, Module, Type, OnModuleInit, Provider, Logger } from '@nestjs/common';
import { Reflector, DiscoveryService, DiscoveryModule } from '@nestjs/core';
import { MediatorBus } from './services/index.js';
import { CommandBus } from './services/command.bus.js';
import { QueryBus } from './services/query.bus.js';
import { EventBus } from './services/event.bus.js';
import { PipelineOrchestrator } from './services/pipeline.orchestrator.js';
import {
  COMMAND_HANDLER_METADATA,
  QUERY_HANDLER_METADATA,
  PIPELINE_BEHAVIOR_METADATA,
  EVENT_HANDLER_METADATA,
  EVENT_CRITICALITY_METADATA,
  EventCriticalityMetadata,
} from './decorators/index.js';
import { configureEventStore } from './event-store/strategies/index.js';
import {
  ICommand,
  ICommandHandler,
  IQuery,
  IQueryHandler,
  IPipelineBehavior,
  PipelineBehaviorOptions,
  IEvent,
  IEventConsumer,
  EventStoreConfig,
  EVENT_STORE_REPOSITORY,
} from './interfaces/index.js';
import {
  LoggingBehavior,
  ValidationBehavior,
  ExceptionHandlingBehavior,
  PerformanceBehavior,
} from './behaviors/index.js';
import { StepEmitter } from './mediator-flow/step-emitter.js';
import { TopologyCollector } from './mediator-flow/topology-collector.js';
import { MediatorFlowExporterConfig } from './mediator-flow/protocol.js';

/**
 * Configuration options for {@link NestMediatorModule.forRoot}.
 *
 * All options are optional — calling `forRoot()` with no arguments gives you
 * a working mediator with zero built-in behaviors. Enable what you need.
 */
export interface NestMediatorModuleOptions {
  /**
   * Enable the built-in logging behavior.
   * Logs every command/query dispatch with handler name and timing information.
   * @default false
   */
  enableLogging?: boolean;

  /**
   * Enable the built-in validation behavior.
   * Validates incoming requests using `class-validator` decorators if available.
   * Requires `class-validator` and `class-transformer` as peer dependencies.
   * @default false
   */
  enableValidation?: boolean;

  /**
   * Enable the built-in exception handling behavior.
   * Wraps handler execution with centralized exception logging.
   * Exceptions are still re-thrown after being logged.
   * @default false
   */
  enableExceptionHandling?: boolean;

  /**
   * Enable the built-in performance tracking behavior.
   * Logs warnings when request handling exceeds {@link performanceThresholdMs}.
   * @default false
   */
  enablePerformanceTracking?: boolean;

  /**
   * Performance threshold in milliseconds.
   * Requests exceeding this duration will be logged as warnings.
   * Only applies when {@link enablePerformanceTracking} is `true`.
   * @default 500
   */
  performanceThresholdMs?: number;

  /**
   * Event store configuration for persisting domain events.
   * If not provided, events are published but not persisted to a database.
   *
   * Supports three mutually exclusive connection strategies:
   * - **Option 1:** Provide `url` — the library creates and manages a connection pool
   * - **Option 2:** Provide `useExistingPool` — reuse your application's existing database pool
   * - **Option 3:** Provide `useExistingRepository` — supply a custom repository implementation
   *
   * @example
   * ```typescript
   * // Option 1: Library-managed connection
   * eventStore: {
   *   type: 'postgres',
   *   url: process.env.DATABASE_URL,
   *   mode: 'audit',
   * }
   *
   * // Option 2: Reuse existing pool
   * eventStore: {
   *   type: 'postgres',
   *   useExistingPool: existingPgPool,
   *   mode: 'event-sourcing',
   * }
   *
   * // Option 3: Custom repository
   * eventStore: {
   *   type: 'postgres',
   *   useExistingRepository: MyCustomEventStoreRepo,
   * }
   * ```
   */
  eventStore?: EventStoreConfig;

  /**
   * MediatorFlow exporter configuration for real-time telemetry.
   * When enabled, execution steps (command dispatches, handler completions,
   * event publications, consumer outcomes, behavior execution, compensation chains)
   * are batched and shipped to a MediatorFlow collector server.
   *
   * The collector server stores these steps and provides a visual dashboard
   * for monitoring, debugging, and tracing CQRS flows.
   *
   * @example
   * ```typescript
   * mediatorFlow: {
   *   enabled: true,
   *   collectorUrl: 'http://localhost:4000',
   *   serviceName: 'order-service',
   *   batchSize: 50,           // flush every 50 steps (default)
   *   flushIntervalMs: 2000,   // or every 2 seconds (default)
   *   includePayloads: false,  // omit command/event payloads for privacy (default)
   *   httpTimeoutMs: 3000,     // timeout for flush HTTP calls (default)
   * }
   * ```
   */
  mediatorFlow?: MediatorFlowExporterConfig;
}

/**
 * Injection token for accessing the module options at runtime.
 * @internal
 */
export const NEST_MEDIATOR_OPTIONS = 'NEST_MEDIATOR_OPTIONS';

/**
 * Root module for the NestMediator CQRS library.
 *
 * Automatically discovers and registers all decorated handlers, behaviors,
 * and event consumers from your application's providers at startup.
 *
 * Use {@link NestMediatorModule.forRoot} to configure the module.
 * The module is registered as `global: true`, so you only need to import it
 * once in your root `AppModule`.
 */
@Module({})
export class NestMediatorModule implements OnModuleInit {
  constructor(
    private readonly mediatorBus: MediatorBus,
    private readonly reflector: Reflector,
    private readonly discoveryService: DiscoveryService
  ) {}

  onModuleInit() {
    const providers = this.discoveryService.getProviders();

    for (const wrapper of providers) {
      if (!wrapper.metatype || !wrapper.instance) {
        continue;
      }

      const isFunction = typeof wrapper.metatype === 'function';
      const isConstructor =
        isFunction && wrapper.metatype.prototype !== undefined;

      if (!isConstructor) {
        continue;
      }

      const handlerType = wrapper.metatype as Type;

      // Register command handlers
      const commandMetadata = this.reflector.get<Type<ICommand>>(
        COMMAND_HANDLER_METADATA,
        handlerType
      );

      if (commandMetadata) {
        console.log(
          `[NestMediator] Registering command handler: ${handlerType.name} for command: ${commandMetadata.name}`
        );
        this.mediatorBus.registerCommandHandler(
          commandMetadata,
          handlerType as Type<ICommandHandler<any>>
        );
      }

      // Register query handlers
      const queryMetadata = this.reflector.get<Type<IQuery>>(
        QUERY_HANDLER_METADATA,
        handlerType
      );

      if (queryMetadata) {
        console.log(
          `[NestMediator] Registering query handler: ${handlerType.name} for query: ${queryMetadata.name}`
        );
        this.mediatorBus.registerQueryHandler(
          queryMetadata,
          handlerType as Type<IQueryHandler<any, any>>
        );
      }

      // Register pipeline behaviors
      const behaviorMetadata = this.reflector.get<PipelineBehaviorOptions>(
        PIPELINE_BEHAVIOR_METADATA,
        handlerType
      );

      if (behaviorMetadata) {
        // Try to infer request type from handle method's first parameter.
        // This only works if the behavior's handle() method has a typed
        // first parameter (e.g., `handle(request: CreateOrderCommand, ...)`).
        const handleParamTypes = Reflect.getMetadata(
          'design:paramtypes',
          handlerType.prototype,
          'handle'
        );

        // Get the first parameter type (the request type).
        // Only use it if it's a concrete class — not Object, Function, or undefined,
        // which indicate that TypeScript erased the type to a generic.
        let requestType: Function | undefined;
        if (handleParamTypes && handleParamTypes[0]) {
          const firstParamType = handleParamTypes[0];
          // Exclude generic types like Object, Function that indicate no specific type
          if (
            firstParamType !== Object &&
            firstParamType !== Function &&
            typeof firstParamType === 'function'
          ) {
            requestType = firstParamType;
          }
        }

        const requestTypeInfo = requestType ? `, requestType: ${requestType.name}` : '';
        console.log(
          `[NestMediator] Registering pipeline behavior: ${handlerType.name} (priority: ${behaviorMetadata.priority ?? 0}, scope: ${behaviorMetadata.scope ?? 'all'}${requestTypeInfo})`
        );
        this.mediatorBus.registerPipelineBehavior(
          handlerType as Type<IPipelineBehavior<any, any>>,
          behaviorMetadata,
          requestType
        );
      }

      // Register event handlers
      const eventMetadata = this.reflector.get<Type<IEvent>>(
        EVENT_HANDLER_METADATA,
        handlerType
      );

      if (eventMetadata) {
        // Get criticality metadata (if any) — determines whether the consumer
        // is critical (sequential + compensatable) or non-critical (parallel).
        const criticalityMetadata = this.reflector.get<EventCriticalityMetadata>(
          EVENT_CRITICALITY_METADATA,
          handlerType
        );

        const criticalityInfo = criticalityMetadata
          ? ` (criticality: ${criticalityMetadata.criticality}, order: ${criticalityMetadata.order})`
          : ' (criticality: non-critical)';

        console.log(
          `[NestMediator] Registering event handler: ${handlerType.name} for event: ${eventMetadata.name}${criticalityInfo}`
        );
        this.mediatorBus.registerEventHandler(
          eventMetadata,
          handlerType as Type<IEventConsumer<any>>,
          criticalityMetadata
        );
      }
    }
  }

  /**
   * Register the NestMediator module with optional configuration.
   *
   * Handlers, behaviors, and event consumers are automatically discovered
   * from the application's providers via decorator metadata — no manual
   * registration required.
   *
   * The module is registered as `global: true`, so importing it once in
   * your root `AppModule` makes {@link MediatorBus} available everywhere.
   *
   * @param options - Optional configuration for behaviors, event store, and telemetry
   * @returns Dynamic module ready for NestJS to initialize
   *
   * @example
   * ```typescript
   * // Minimal setup — just the mediator, no built-in behaviors
   * NestMediatorModule.forRoot()
   *
   * // Enable built-in behaviors
   * NestMediatorModule.forRoot({
   *   enableLogging: true,
   *   enableValidation: true,
   *   enableExceptionHandling: true,
   *   enablePerformanceTracking: true,
   *   performanceThresholdMs: 1000,
   * })
   *
   * // With event store (audit mode)
   * NestMediatorModule.forRoot({
   *   eventStore: {
   *     type: 'postgres',
   *     url: process.env.DATABASE_URL,
   *     mode: 'audit',
   *   },
   * })
   *
   * // With MediatorFlow telemetry
   * NestMediatorModule.forRoot({
   *   enableLogging: true,
   *   mediatorFlow: {
   *     enabled: true,
   *     collectorUrl: 'http://localhost:4000',
   *     serviceName: 'order-service',
   *   },
   * })
   *
   * // Full configuration
   * NestMediatorModule.forRoot({
   *   enableLogging: true,
   *   enableValidation: true,
   *   enableExceptionHandling: true,
   *   enablePerformanceTracking: true,
   *   performanceThresholdMs: 500,
   *   eventStore: {
   *     type: 'postgres',
   *     url: process.env.DATABASE_URL,
   *     mode: 'event-sourcing',
   *   },
   *   mediatorFlow: {
   *     enabled: true,
   *     collectorUrl: process.env.MEDIATOR_FLOW_URL,
   *     serviceName: 'order-service',
   *     includePayloads: process.env.NODE_ENV === 'development',
   *   },
   * })
   * ```
   */
  static forRoot(options: NestMediatorModuleOptions = {}): DynamicModule {
    const logger = new Logger('NestMediatorModule');
    const builtInProviders: Type[] = [];
    const eventStoreProviders: Provider[] = [];
    const mediatorFlowProviders: Provider[] = [];

    // Add built-in behaviors based on options
    if (options.enableExceptionHandling) {
      builtInProviders.push(ExceptionHandlingBehavior);
    }

    if (options.enableLogging) {
      builtInProviders.push(LoggingBehavior);
    }

    if (options.enablePerformanceTracking) {
      builtInProviders.push(PerformanceBehavior);
    }

    if (options.enableValidation) {
      builtInProviders.push(ValidationBehavior);
    }

    // Configure event store if provided
    if (options.eventStore) {
      const config = options.eventStore;

      // Validate configuration — type is always required
      if (!config.type) {
        throw new Error('EventStore config.type is required');
      }

      // Count how many connection/repository options are set
      const optionsSet = [
        config.url,
        config.useExistingPool,
        config.useExistingRepository,
      ].filter(Boolean).length;

      // Option 3 (useExistingRepository) can optionally have url for schema creation
      if (config.useExistingRepository) {
        if (config.useExistingPool) {
          throw new Error(
            'EventStore config cannot specify both useExistingRepository and useExistingPool'
          );
        }
        // url is optional for useExistingRepository (used for schema creation only)
      } else {
        // Options 1 and 2 require exactly one of url or useExistingPool
        if (!config.url && !config.useExistingPool) {
          throw new Error(
            'EventStore config must specify url, useExistingPool, or useExistingRepository'
          );
        }
        if (config.url && config.useExistingPool) {
          throw new Error('EventStore config cannot specify both url and useExistingPool');
        }
      }

      // Delegate to strategy-specific provider setup
      configureEventStore(eventStoreProviders, config);
    }

    // ─── MediatorFlow telemetry ──────────────────────────────────────
    // StepEmitter is always registered (as a no-op when disabled) so that
    // other services can inject it without conditional logic.
    mediatorFlowProviders.push(StepEmitter);

    if (options.mediatorFlow?.enabled) {
      mediatorFlowProviders.push({
        provide: 'MEDIATOR_FLOW_CONFIG',
        useFactory: (emitter: StepEmitter) => {
          emitter.configure(options.mediatorFlow!);
          return options.mediatorFlow!;
        },
        inject: [StepEmitter],
      });

      mediatorFlowProviders.push(TopologyCollector);
    }

    return {
      module: NestMediatorModule,
      imports: [DiscoveryModule],
      providers: [
        PipelineOrchestrator,
        CommandBus,
        QueryBus,
        EventBus,
        MediatorBus,
        Reflector,
        ...builtInProviders,
        ...eventStoreProviders,
        ...mediatorFlowProviders,
        {
          provide: NEST_MEDIATOR_OPTIONS,
          useValue: options,
        },
      ],
      exports: options.eventStore
        ? [MediatorBus, EVENT_STORE_REPOSITORY]
        : [MediatorBus],
      global: true,
    };
  }
}
