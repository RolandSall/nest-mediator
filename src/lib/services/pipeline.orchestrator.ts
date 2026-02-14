import { Injectable, Logger, Optional, Type } from '@nestjs/common';
import { ModuleRef, Reflector } from '@nestjs/core';
import {
  IPipelineBehavior,
  PipelineBehaviorOptions,
} from '../interfaces/pipeline-behavior.interface.js';
import { SKIP_BEHAVIORS_METADATA } from '../decorators/skip-behavior.decorator.js';
import { StepEmitter } from '../mediator-flow/step-emitter.js';
import { StepType } from '../mediator-flow/protocol.js';

/**
 * Registered behavior with its metadata
 */
export interface RegisteredBehavior {
  type: Type<IPipelineBehavior<any, any>>;
  options: PipelineBehaviorOptions;
  /**
   * The specific request type this behavior applies to.
   * When undefined, behavior applies to all requests.
   */
  requestType?: Function;
}

/**
 * Orchestrates pipeline behaviors for commands and queries.
 * Manages behavior registration and builds execution pipelines.
 */
@Injectable()
export class PipelineOrchestrator {
  private readonly logger = new Logger('PipelineOrchestrator');
  private readonly behaviors: RegisteredBehavior[] = [];

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly reflector: Reflector,
    @Optional() private readonly stepEmitter?: StepEmitter,
  ) {}

  /**
   * Register a pipeline behavior
   * @param behaviorType - The behavior class
   * @param options - Behavior options (priority, scope)
   * @param requestType - Optional specific request type this behavior applies to
   */
  registerBehavior(
    behaviorType: Type<IPipelineBehavior<any, any>>,
    options: PipelineBehaviorOptions,
    requestType?: Function
  ): void {
    this.behaviors.push({ type: behaviorType, options, requestType });

    // Keep behaviors sorted by priority (lower first)
    this.behaviors.sort(
      (a, b) => (a.options.priority ?? 0) - (b.options.priority ?? 0)
    );

    const requestTypeInfo = requestType ? `, requestType: ${requestType.name}` : '';
    this.logger.log(
      `Registered pipeline behavior: ${behaviorType.name} (priority: ${options.priority ?? 0}, scope: ${options.scope ?? 'all'}${requestTypeInfo})`
    );
  }

  /**
   * Build a pipeline of behaviors around the handler
   * @param request - The request object (command or query)
   * @param scope - The scope ('command' or 'query')
   * @param handler - The innermost handler function
   * @returns A function that executes the full pipeline
   */
  buildPipeline<TRequest, TResponse>(
    request: TRequest,
    scope: 'command' | 'query',
    handler: () => Promise<TResponse>
  ): () => Promise<TResponse> {
    // Get behaviors to skip from request metadata
    const requestClass = (request as object).constructor;
    const behaviorsToSkip: Type<IPipelineBehavior>[] =
      this.reflector.get<Type<IPipelineBehavior>[]>(
        SKIP_BEHAVIORS_METADATA,
        requestClass,
      ) ?? [];

    // Filter behaviors by scope, skip list, and request type
    const applicableBehaviors = this.behaviors.filter((b) => {
      // Check scope
      const behaviorScope = b.options.scope ?? 'all';
      const scopeMatches = behaviorScope === 'all' || behaviorScope === scope;

      // Check if this behavior should be skipped
      const shouldSkip = behaviorsToSkip.some(
        (skipType) => skipType === b.type,
      );

      // Check request type match
      const requestTypeMatches = !b.requestType || request instanceof (b.requestType as any);

      return scopeMatches && !shouldSkip && requestTypeMatches;
    });

    // If no behaviors, just return the handler
    if (applicableBehaviors.length === 0) {
      return handler;
    }

    const emitter = this.stepEmitter;

    // Build the pipeline from right to left (innermost to outermost)
    return applicableBehaviors.reduceRight<() => Promise<TResponse>>(
      (next, registeredBehavior) => {
        return async () => {
          const behavior = this.moduleRef.get<
            IPipelineBehavior<TRequest, TResponse>
          >(registeredBehavior.type, { strict: false });

          if (emitter?.enabled) {
            return emitter.wrapAsync(
              StepType.BEHAVIOR_ENTERED,
              StepType.BEHAVIOR_COMPLETED,
              StepType.BEHAVIOR_FAILED,
              registeredBehavior.type.name,
              () => behavior.handle(request, next),
            );
          }
          return behavior.handle(request, next);
        };
      },
      handler
    );
  }

  /**
   * Get registered behavior names (for debugging)
   */
  getRegisteredBehaviors(): string[] {
    return this.behaviors.map((b) => b.type.name);
  }

  /**
   * Get detailed behavior registrations (for MediatorFlow topology)
   */
  getRegisteredBehaviorsDetailed(): {
    behaviorName: string;
    priority: number;
    scope: string;
    requestTypeName?: string;
  }[] {
    return this.behaviors.map((b) => ({
      behaviorName: b.type.name,
      priority: b.options.priority ?? 0,
      scope: b.options.scope ?? 'all',
      requestTypeName: b.requestType?.name,
    }));
  }
}
