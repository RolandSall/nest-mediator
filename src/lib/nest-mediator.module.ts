import { DynamicModule, Module, Type, OnModuleInit } from '@nestjs/common';
import { Reflector, DiscoveryService, DiscoveryModule } from '@nestjs/core';
import { MediatorBus } from './services/index.js';
import {
  COMMAND_HANDLER_METADATA,
  QUERY_HANDLER_METADATA,
  PIPELINE_BEHAVIOR_METADATA,
} from './decorators/index.js';
import {
  ICommand,
  ICommandHandler,
  IQuery,
  IQueryHandler,
  IPipelineBehavior,
  PipelineBehaviorOptions,
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
   * Custom pipeline behaviors to register.
   * These will be registered in addition to any behaviors
   * discovered via @PipelineBehavior decorator.
   */
  behaviors?: Type<IPipelineBehavior<any, any>>[];
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
        console.log(
          `[NestMediator] Registering pipeline behavior: ${handlerType.name} (priority: ${behaviorMetadata.priority ?? 0}, scope: ${behaviorMetadata.scope ?? 'all'})`
        );
        this.mediatorBus.registerPipelineBehavior(
          handlerType as Type<IPipelineBehavior<any, any>>,
          behaviorMetadata
        );
      }
    }
  }

  /**
   * Register the NestMediator module with default settings.
   * Handlers and behaviors are automatically discovered from the application's providers.
   * @returns Dynamic module
   */
  static forRoot(): DynamicModule {
    return this.forRootAsync({});
  }

  /**
   * Register the NestMediator module with custom configuration.
   *
   * @param options - Configuration options
   * @returns Dynamic module
   *
   * @example
   * ```typescript
   * // Enable built-in behaviors
   * NestMediatorModule.forRootAsync({
   *   enableLogging: true,
   *   enableValidation: true,
   *   enableExceptionHandling: true,
   *   enablePerformanceTracking: true,
   *   performanceThresholdMs: 1000,
   * })
   *
   * // With custom behaviors
   * NestMediatorModule.forRootAsync({
   *   behaviors: [MyCustomBehavior],
   * })
   * ```
   */
  static forRootAsync(options: NestMediatorModuleOptions = {}): DynamicModule {
    const builtInProviders: Type[] = [];

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

    // Add custom behaviors
    const customBehaviors = options.behaviors ?? [];

    return {
      module: NestMediatorModule,
      imports: [DiscoveryModule],
      providers: [
        MediatorBus,
        Reflector,
        ...builtInProviders,
        ...customBehaviors,
        {
          provide: NEST_MEDIATOR_OPTIONS,
          useValue: options,
        },
      ],
      exports: [MediatorBus],
      global: true,
    };
  }
}
