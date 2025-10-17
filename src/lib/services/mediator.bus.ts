import { Injectable, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ICommand, ICommandHandler, IQuery, IQueryHandler } from '../interfaces/index.js';

@Injectable()
export class MediatorBus {
  private commandHandlers = new Map<string, Type<ICommandHandler<any>>>();
  private queryHandlers = new Map<string, Type<IQueryHandler<any, any>>>();

  constructor(private readonly moduleRef: ModuleRef) {}

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
      throw new Error(`Command handler for ${commandName} is already registered`);
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
   * Send a command to its handler
   * @param command - The command instance
   * @returns Promise<void>
   */
  async send<TCommand extends ICommand>(
    command: TCommand
  ): Promise<void> {
    const commandName = command.constructor.name;
    const handlerType = this.commandHandlers.get(commandName);

    if (!handlerType) {
      throw new Error(
        `No handler registered for command: ${commandName}. Did you forget to add @CommandHandler decorator?`
      );
    }

    const handler = this.moduleRef.get<ICommandHandler<TCommand>>(
      handlerType,
      { strict: false }
    );

    await handler.execute(command);
  }

  /**
   * Execute a query through its handler
   * @param query - The query instance
   * @returns Promise with the result
   */
  async query<TQuery extends IQuery, TResult = any>(
    query: TQuery
  ): Promise<TResult> {
    const queryName = query.constructor.name;
    const handlerType = this.queryHandlers.get(queryName);

    if (!handlerType) {
      throw new Error(
        `No handler registered for query: ${queryName}. Did you forget to add @QueryHandler decorator?`
      );
    }

    const handler = this.moduleRef.get<IQueryHandler<TQuery, TResult>>(
      handlerType,
      { strict: false }
    );

    return handler.execute(query);
  }
}
