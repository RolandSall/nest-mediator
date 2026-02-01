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
 * Acts as a facade delegating to specialized buses.
 *
 * @example
 * ```typescript
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
export class MediatorBus implements IMediator {
    constructor(
        private readonly commandBus: CommandBus,
        private readonly queryBus: QueryBus,
        private readonly eventBus: EventBus,
        private readonly pipelineOrchestrator: PipelineOrchestrator,
    ) {
    }

    /**
     * Send a command to its handler through the pipeline.
     * Automatically creates a new correlation context.
     * @param command - The command instance
     */
    async send<TCommand extends ICommand>(command: TCommand): Promise<void> {
        return mediatorContext.runWithNewContext(() => {
            return this.commandBus.send(command);
        });
    }

    /**
     * Execute a query through its handler and the pipeline.
     * Automatically creates a new correlation context.
     * @param query - The query instance
     * @returns Promise with the result
     */
    async query<TQuery extends IQuery, TResult = any>(
        query: TQuery
    ): Promise<TResult> {
        return mediatorContext.runWithNewContext(() => {
            return this.queryBus.query(query);
        });
    }

    /**
     * Publish an event to all its consumers.
     * If not already in a context, creates a new one.
     * @param event - The event instance
     * @returns Promise with the publish result
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
     * Publish multiple events sequentially.
     * All events share the same correlation context.
     * @param events - The events to publish
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
     * Register a command handler
     * @param command - The command class
     * @param handler - The handler class
     */
    registerCommandHandler(
        command: Type<ICommand>,
        handler: Type<ICommandHandler<any>>
    ): void {
        this.commandBus.registerCommandHandler(command, handler);
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
        this.queryBus.registerQueryHandler(query, handler);
    }

    /**
     * Register a pipeline behavior
     * @param behaviorType - The behavior class
     * @param options - Behavior options (priority, scope)
     * @param requestType - Optional specific request type this behavior applies to
     */
    registerPipelineBehavior(
        behaviorType: Type<IPipelineBehavior<any, any>>,
        options: PipelineBehaviorOptions,
        requestType?: Function
    ): void {
        this.pipelineOrchestrator.registerBehavior(behaviorType, options, requestType);
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
        this.eventBus.registerEventHandler(event, handler, criticalityMetadata);
    }

    /**
     * Get registered command names (for debugging)
     */
    getRegisteredCommands(): string[] {
        return this.commandBus.getRegisteredCommands();
    }

    /**
     * Get registered query names (for debugging)
     */
    getRegisteredQueries(): string[] {
        return this.queryBus.getRegisteredQueries();
    }

    /**
     * Get registered behavior names (for debugging)
     */
    getRegisteredBehaviors(): string[] {
        return this.pipelineOrchestrator.getRegisteredBehaviors();
    }

    /**
     * Get registered events and their consumers (for debugging)
     */
    getRegisteredEvents(): {
        event: string;
        handlers: { name: string; criticality: string; order: number }[];
    }[] {
        return this.eventBus.getRegisteredEvents();
    }
}
