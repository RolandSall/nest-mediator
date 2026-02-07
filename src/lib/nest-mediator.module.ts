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

/**
 * Configuration options for NestMediatorModule
 */
export interface NestMediatorModuleOptions {
  /**
   * Enable built-in logging behavior.
   * Logs request handling with timing information.
   * Default: false
   */
  enableLogging?: boolean;

  /**
   * Enable built-in validation behavior.
   * Validates requests using class-validator if available.
   * Default: false
   */
  enableValidation?: boolean;

  /**
   * Enable built-in exception handling behavior.
   * Provides centralized exception logging.
   * Default: false
   */
  enableExceptionHandling?: boolean;

  /**
   * Enable built-in performance tracking behavior.
   * Logs warnings for slow requests.
   * Default: false
   */
  enablePerformanceTracking?: boolean;

  /**
   * Performance threshold in milliseconds.
   * Requests exceeding this will be logged as warnings.
   * Only applies when enablePerformanceTracking is true.
   * Default: 500
   */
  performanceThresholdMs?: number;

  /**
   * Event store configuration for event persistence.
   * If not provided, events are not persisted to a database.
   *
   * Supports three connection options:
   * - Option 1: Provide `url` - library manages connection
   * - Option 2: Provide `useExistingPool` - reuse existing connection pool
   * - Option 3: Provide `repository` - use custom repository implementation
   */
  eventStore?: EventStoreConfig;
}

/**
 * Token for module options injection
 */
export const NEST_MEDIATOR_OPTIONS = 'NEST_MEDIATOR_OPTIONS';

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
        // Try to infer request type from handle method's first parameter
        // This only works if @PipelineBehavior() decorator is applied to the handle method
        const handleParamTypes = Reflect.getMetadata(
          'design:paramtypes',
          handlerType.prototype,
          'handle'
        );

        // Get the first parameter type (the request type)
        // Only use it if it's a concrete class (not Object, Function, or undefined)
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
        // Get criticality metadata (if any)
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
   * Register the NestMediator module.
   * Handlers and behaviors are automatically discovered from the application's providers.
   *
   * @param options - Optional configuration options
   * @returns Dynamic module
   *
   * @example
   * ```typescript
   * // Basic setup (no built-in behaviors)
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
   * ```
   */
  static forRoot(options: NestMediatorModuleOptions = {}): DynamicModule {
    const logger = new Logger('NestMediatorModule');
    const builtInProviders: Type[] = [];
    const eventStoreProviders: Provider[] = [];

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

      // Validate configuration
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

      // Delegate to strategies
      configureEventStore(eventStoreProviders, config);
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
