import { Injectable, Logger, Type } from '@nestjs/common';
import { ModuleRef, Reflector } from '@nestjs/core';
import {
  ICommand,
  ICommandHandler,
  IQuery,
  IQueryHandler,
} from '../interfaces/index.js';
import {
  IPipelineBehavior,
  PipelineBehaviorOptions,
} from '../interfaces/pipeline-behavior.interface.js';
import { HandlerNotFoundException } from '../exceptions/handler-not-found.exception.js';
import { SKIP_BEHAVIORS_METADATA } from '../decorators/skip-behavior.decorator.js';

/**
 * Registered behavior with its metadata
 */
interface RegisteredBehavior {
  type: Type<IPipelineBehavior<any, any>>;
  options: PipelineBehaviorOptions;
}

/**
 * Central mediator bus for dispatching commands and queries.
 * Supports pipeline behaviors for cross-cutting concerns.
 *
 * @example
 * ```typescript
 * // In a controller
 * @Controller('users')
 * export class UserController {
 *   constructor(private readonly mediator: MediatorBus) {}
 *
 *   @Post()
 *   async create(@Body() dto: CreateUserDto) {
 *     await this.mediator.send(new CreateUserCommand(dto));
 *   }
 *
 *   @Get(':id')
 *   async findOne(@Param('id') id: string) {
 *     return this.mediator.query(new GetUserQuery(id));
 *   }
 * }
 * ```
 */
@Injectable()
export class MediatorBus {
  private readonly logger = new Logger('MediatorBus');

  private commandHandlers = new Map<string, Type<ICommandHandler<any>>>();
  private queryHandlers = new Map<string, Type<IQueryHandler<any, any>>>();
  private pipelineBehaviors: RegisteredBehavior[] = [];

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly reflector: Reflector,
  ) {}

  /**
   * Register a command handler
   * @param command - The command class
   * @param handler - The handler class
   */
  registerCommandHandler(
    command: Type<ICommand>,
    handler: Type<ICommandHandler<any>>
  ): void {
    const commandName = command.name;
    if (this.commandHandlers.has(commandName)) {
      throw new Error(
        `Command handler for ${commandName} is already registered`
      );
    }
    this.commandHandlers.set(commandName, handler);
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
    if (this.queryHandlers.has(queryName)) {
      throw new Error(`Query handler for ${queryName} is already registered`);
    }
    this.queryHandlers.set(queryName, handler);
  }

  /**
   * Register a pipeline behavior
   * @param behaviorType - The behavior class
   * @param options - Behavior options (priority, scope)
   */
  registerPipelineBehavior(
    behaviorType: Type<IPipelineBehavior<any, any>>,
    options: PipelineBehaviorOptions
  ): void {
    this.pipelineBehaviors.push({ type: behaviorType, options });

    // Keep behaviors sorted by priority (lower first)
    this.pipelineBehaviors.sort(
      (a, b) => (a.options.priority ?? 0) - (b.options.priority ?? 0)
    );

    this.logger.log(
      `Registered pipeline behavior: ${behaviorType.name} (priority: ${options.priority ?? 0}, scope: ${options.scope ?? 'all'})`
    );
  }

  /**
   * Send a command to its handler through the pipeline
   * @param command - The command instance
   * @returns Promise<void>
   */
  async send<TCommand extends ICommand>(command: TCommand): Promise<void> {
    const commandName = command.constructor.name;
    const handlerType = this.commandHandlers.get(commandName);

    if (!handlerType) {
      throw new HandlerNotFoundException(commandName, 'command');
    }

    const handler = this.moduleRef.get<ICommandHandler<TCommand>>(handlerType, {
      strict: false,
    });

    // Build and execute pipeline
    const pipeline = this.buildPipeline<TCommand, void>(
      command,
      'command',
      () => handler.execute(command)
    );

    await pipeline();
  }

  /**
   * Execute a query through its handler and the pipeline
   * @param query - The query instance
   * @returns Promise with the result
   */
  async query<TQuery extends IQuery, TResult = any>(
    query: TQuery
  ): Promise<TResult> {
    const queryName = query.constructor.name;
    const handlerType = this.queryHandlers.get(queryName);

    if (!handlerType) {
      throw new HandlerNotFoundException(queryName, 'query');
    }

    const handler = this.moduleRef.get<IQueryHandler<TQuery, TResult>>(
      handlerType,
      { strict: false }
    );

    // Build and execute pipeline
    const pipeline = this.buildPipeline<TQuery, TResult>(query, 'query', () =>
      handler.execute(query)
    );

    return pipeline();
  }

  /**
   * Build a pipeline of behaviors around the handler
   * Uses reduceRight to create a chain where the first behavior wraps all others
   */
  private buildPipeline<TRequest, TResponse>(
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

    // Filter behaviors by scope and skip list
    const applicableBehaviors = this.pipelineBehaviors.filter((b) => {
      // Check scope
      const behaviorScope = b.options.scope ?? 'all';
      const scopeMatches = behaviorScope === 'all' || behaviorScope === scope;

      // Check if this behavior should be skipped
      const shouldSkip = behaviorsToSkip.some(
        (skipType) => skipType === b.type,
      );

      return scopeMatches && !shouldSkip;
    });

    // If no behaviors, just return the handler
    if (applicableBehaviors.length === 0) {
      return handler;
    }

    // Build the pipeline from right to left (innermost to outermost)
    // The last behavior in the array wraps the handler directly
    // The first behavior in the array is the outermost wrapper
    return applicableBehaviors.reduceRight<() => Promise<TResponse>>(
      (next, registeredBehavior) => {
        return async () => {
          const behavior = this.moduleRef.get<
            IPipelineBehavior<TRequest, TResponse>
          >(registeredBehavior.type, { strict: false });

          return behavior.handle(request, next);
        };
      },
      handler
    );
  }

  /**
   * Get registered command handler names (for debugging)
   */
  getRegisteredCommands(): string[] {
    return Array.from(this.commandHandlers.keys());
  }

  /**
   * Get registered query handler names (for debugging)
   */
  getRegisteredQueries(): string[] {
    return Array.from(this.queryHandlers.keys());
  }

  /**
   * Get registered behavior names (for debugging)
   */
  getRegisteredBehaviors(): string[] {
    return this.pipelineBehaviors.map((b) => b.type.name);
  }
}
