import { Injectable, Optional, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { IQuery, IQueryHandler, IQueryBus } from '../interfaces/index.js';
import { HandlerNotFoundException } from '../exceptions/handler-not-found.exception.js';
import { PipelineOrchestrator } from './pipeline.orchestrator.js';
import { StepEmitter } from '../mediator-flow/step-emitter.js';
import { StepType } from '../mediator-flow/protocol.js';
import { mediatorContext } from '../context';

/**
 * Query bus implementation.
 * Dispatches queries to their handlers through the pipeline.
 */
@Injectable()
export class QueryBus implements IQueryBus {
  private readonly handlers = new Map<string, Type<IQueryHandler<any, any>>>();

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly pipelineOrchestrator: PipelineOrchestrator,
    @Optional() private readonly stepEmitter?: StepEmitter,
  ) {}

  /**
   * Execute a query through its handler and the pipeline
   * @param query - The query instance
   * @returns Promise with the result
   */
  async query<TQuery extends IQuery, TResult = any>(
    query: TQuery
  ): Promise<TResult> {
    const queryName = query.constructor.name;
    const handlerType = this.handlers.get(queryName);

    if (!handlerType) {
      throw new HandlerNotFoundException(queryName, 'query');
    }

    const handler = this.moduleRef.get<IQueryHandler<TQuery, TResult>>(
      handlerType,
      { strict: false }
    );

    this.stepEmitter?.emit(StepType.QUERY_DISPATCHED, queryName);

    // Build and execute pipeline
    const pipeline = this.pipelineOrchestrator.buildPipeline<TQuery, TResult>(
      query,
      'query',
      () =>
        this.stepEmitter
          ? this.stepEmitter.wrapAsync(
              StepType.QUERY_HANDLER_STARTED,
              StepType.QUERY_HANDLER_COMPLETED,
              StepType.QUERY_HANDLER_FAILED,
              handlerType.name,
              () => {
                mediatorContext.getContext().currentHandlerName = handlerType.name;
                return handler.execute(query);
              },
            )
          : (() => {
              mediatorContext.getContext().currentHandlerName = handlerType.name;
              return handler.execute(query);
            })(),
    );

    return pipeline();
  }

  /**
   * Register a query handler
   * @param query - The query class
   * @param handler - The handler class
   */
  registerQueryHandler(
    query: Type<IQuery>,
    handler: Type<IQueryHandler<any, any>>
  ): void {
    const queryName = query.name;
    if (this.handlers.has(queryName)) {
      throw new Error(`Query handler for ${queryName} is already registered`);
    }
    this.handlers.set(queryName, handler);
  }

  /**
   * Get registered query names (for debugging)
   */
  getRegisteredQueries(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Get detailed query registrations (for MediatorFlow topology)
   */
  getRegisteredQueriesDetailed(): { queryName: string; handlerName: string }[] {
    return Array.from(this.handlers.entries()).map(([queryName, handlerType]) => ({
      queryName,
      handlerName: handlerType.name,
    }));
  }
}
