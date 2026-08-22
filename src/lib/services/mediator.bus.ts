import {Injectable, Type} from '@nestjs/common';
import {
    ICommand,
    ICommandHandler,
    IQuery,
    IQueryHandler,
    IEvent,
    IEventConsumer,
    EventPublishResult,
    IMediator,
    EventCriticalityMetadata,
} from '../interfaces/index.js';
import {
    IPipelineBehavior,
    PipelineBehaviorOptions,
} from '../interfaces/pipeline-behavior.interface.js';
import {CommandBus} from './command.bus.js';
import {QueryBus} from './query.bus.js';
import {EventBus} from './event.bus.js';
import {PipelineOrchestrator} from './pipeline.orchestrator.js';
import {mediatorContext} from '../context/mediator-context.js';

/**
 * Central mediator bus for dispatching commands, queries, and events.
 * Acts as a facade over the specialized {@link CommandBus}, {@link QueryBus},
 * and {@link EventBus}, routing each request through the
 * {@link PipelineOrchestrator} before reaching its handler.
 *
 * Every `send` and `query` call automatically creates a new correlation
 * context (via {@link mediatorContext}), ensuring that all downstream
 * events share the same `correlationId` for end-to-end tracing.
 *
 * This is the only class consumers need to inject — handlers, behaviors,
 * and event consumers are registered automatically by
 * {@link NestMediatorModule.forRoot}.
 *
 * @example
 * ```typescript
 * @Controller('orders')
 * export class OrderController {
 *   constructor(private readonly mediator: MediatorBus) {}
 *
 *   @Post()
 *   async create(@Body() dto: CreateOrderDto) {
 *     // Dispatches command through pipeline → handler → events
 *     await this.mediator.send(new PlaceOrderCommand(dto));
 *   }
 *
 *   @Get(':id')
 *   async findOne(@Param('id') id: string) {
 *     // Dispatches query through pipeline → handler → result
 *     return this.mediator.query(new GetOrderQuery(id));
 *   }
 *
 *   @Post(':id/cancel')
 *   async cancel(@Param('id') id: string) {
 *     await this.mediator.send(new CancelOrderCommand(id));
 *   }
 * }
 * ```
 */
@Injectable()
export class MediatorBus implements IMediator {
    constructor(
        private readonly commandBus: CommandBus,
        private readonly queryBus: QueryBus,
        private readonly eventBus: EventBus,
        private readonly pipelineOrchestrator: PipelineOrchestrator,
    ) {
    }

    /**
     * Send a command to its registered handler through the behavior pipeline.
     * Automatically creates a new correlation context so that all events
     * published during handling share the same `correlationId`.
     *
     * Commands return nothing by default. A handler may return a value when the
     * caller opts in with `send<TResult>(command)`. Use {@link query} for read
     * operations; command results are intended for values produced by the
     * write itself, such as a newly generated id.
     *
     * @param command - The command instance to dispatch
     * @throws Error if no handler is registered for the command
     *
     * @example
     * ```typescript
     * // Promise<void> — unchanged from previous versions
     * await mediator.send(new CancelOrderCommand(orderId));
     *
     * // Promise<string> — opt in to the handler result
     * const orderId = await mediator.send<string>(
     *   new PlaceOrderCommand({ customerId: '123', items })
     * );
     * ```
     */
    send<TCommand extends ICommand>(command: TCommand): Promise<void>;
    send<TResult, TCommand extends ICommand = ICommand>(
        command: TCommand
    ): Promise<TResult>;
    async send<TResult = void>(command: ICommand): Promise<TResult> {
        return mediatorContext.runWithNewContext(() => {
            return this.commandBus.send<TResult, ICommand>(command);
        });
    }

    /**
     * Execute a query through its registered handler and the behavior pipeline.
     * Automatically creates a new correlation context.
     *
     * Unlike commands, queries return a result.
     *
     * @param query - The query instance to execute
     * @returns Promise resolving to the handler's result
     * @throws Error if no handler is registered for the query
     *
     * @example
     * ```typescript
     * const order = await mediator.query<GetOrderQuery, OrderDto>(
     *   new GetOrderQuery('order-123')
     * );
     * ```
     */
    async query<TQuery extends IQuery, TResult = any>(
        query: TQuery
    ): Promise<TResult> {
        return mediatorContext.runWithNewContext(() => {
            return this.queryBus.query(query);
        });
    }

    /**
     * Publish an event to all its registered consumers.
     *
     * If called within an existing correlation context (e.g., from inside a
     * command handler), the event inherits that context's `correlationId`.
     * If called standalone (e.g., from a cron job), a new context is created.
     *
     * Critical consumers execute sequentially in order. If any fail,
     * compensation is triggered in reverse order. Non-critical consumers
     * execute in parallel after all critical consumers succeed.
     *
     * @param event - The event instance to publish
     * @returns Promise with the publish result including consumer outcomes
     *
     * @example
     * ```typescript
     * // Inside a handler (inherits context):
     * await this.mediator.publish(new OrderPlacedEvent(orderId));
     *
     * // Standalone (creates new context):
     * await this.mediator.publish(new DailyReportEvent());
     * ```
     */
    async publish<TEvent extends IEvent>(event: TEvent): Promise<EventPublishResult> {
        // If not already in a context (e.g., called directly), create one
        if (!mediatorContext.hasContext()) {
            return mediatorContext.runWithNewContext(() => {
                return this.eventBus.publish(event);
            });
        }
        return this.eventBus.publish(event);
    }

    /**
     * Publish multiple events sequentially within a shared correlation context.
     *
     * If called within an existing context, all events share it. If called
     * standalone, a new context is created for the entire batch.
     *
     * Events are published one at a time in order — each event's consumers
     * complete before the next event is published.
     *
     * @param events - Array of event instances to publish
     *
     * @example
     * ```typescript
     * await mediator.publishAll([
     *   new OrderPlacedEvent(orderId),
     *   new InventoryReservedEvent(orderId, items),
     * ]);
     * ```
     */
    async publishAll<TEvent extends IEvent>(events: TEvent[]): Promise<void> {
        const runPublish = async () => {
            for (const event of events) {
                await this.eventBus.publish(event);
            }
        };

        if (!mediatorContext.hasContext()) {
            return mediatorContext.runWithNewContext(runPublish);
        }
        return runPublish();
    }

    /**
     * Register a command handler mapping.
     * Called automatically by {@link NestMediatorModule} during module initialization —
     * you do not need to call this manually.
     *
     * @param command - The command class (used as lookup key)
     * @param handler - The handler class that processes this command
     * @internal
     */
    registerCommandHandler(
        command: Type<ICommand>,
        handler: Type<ICommandHandler<any>>
    ): void {
        this.commandBus.registerCommandHandler(command, handler);
    }

    /**
     * Register a query handler mapping.
     * Called automatically by {@link NestMediatorModule} during module initialization —
     * you do not need to call this manually.
     *
     * @param query - The query class (used as lookup key)
     * @param handler - The handler class that processes this query
     * @internal
     */
    registerQueryHandler(
        query: Type<IQuery>,
        handler: Type<IQueryHandler<any, any>>
    ): void {
        this.queryBus.registerQueryHandler(query, handler);
    }

    /**
     * Register a pipeline behavior.
     * Called automatically by {@link NestMediatorModule} during module initialization —
     * you do not need to call this manually.
     *
     * @param behaviorType - The behavior class
     * @param options - Behavior configuration (priority determines execution order,
     *   scope limits to 'command', 'query', or 'all')
     * @param requestType - Optional specific request type this behavior applies to.
     *   When set, the behavior only runs for that exact command/query class.
     * @internal
     */
    registerPipelineBehavior(
        behaviorType: Type<IPipelineBehavior<any, any>>,
        options: PipelineBehaviorOptions,
        requestType?: Function
    ): void {
        this.pipelineOrchestrator.registerBehavior(behaviorType, options, requestType);
    }

    /**
     * Register an event consumer.
     * Called automatically by {@link NestMediatorModule} during module initialization —
     * you do not need to call this manually.
     *
     * @param event - The event class this consumer listens to
     * @param handler - The consumer class
     * @param criticalityMetadata - Optional criticality config. When present,
     *   the consumer is treated as critical (sequential, awaited, with compensation).
     *   When absent, the consumer is non-critical (parallel, fire-and-forget).
     * @internal
     */
    registerEventHandler(
        event: Type<IEvent>,
        handler: Type<IEventConsumer<any>>,
        criticalityMetadata?: EventCriticalityMetadata
    ): void {
        this.eventBus.registerEventHandler(event, handler, criticalityMetadata);
    }

    /**
     * Get the names of all registered command handlers.
     * Useful for debugging and introspection.
     *
     * @returns Array of command class names (e.g., `['PlaceOrderCommand', 'CancelOrderCommand']`)
     */
    getRegisteredCommands(): string[] {
        return this.commandBus.getRegisteredCommands();
    }

    /**
     * Get the names of all registered query handlers.
     * Useful for debugging and introspection.
     *
     * @returns Array of query class names (e.g., `['GetOrderQuery', 'ListOrdersQuery']`)
     */
    getRegisteredQueries(): string[] {
        return this.queryBus.getRegisteredQueries();
    }

    /**
     * Get the names of all registered pipeline behaviors.
     * Useful for debugging and verifying the behavior pipeline.
     *
     * @returns Array of behavior class names in priority order
     */
    getRegisteredBehaviors(): string[] {
        return this.pipelineOrchestrator.getRegisteredBehaviors();
    }

    /**
     * Get all registered events and their consumer details.
     * Useful for debugging and verifying event wiring.
     *
     * @returns Array of event registrations, each with consumer name,
     *   criticality level ('critical' or 'non-critical'), and execution order
     */
    getRegisteredEvents(): {
        event: string;
        handlers: { name: string; criticality: string; order: number }[];
    }[] {
        return this.eventBus.getRegisteredEvents();
    }
}
