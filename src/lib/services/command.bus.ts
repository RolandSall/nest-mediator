import { Injectable, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ICommand, ICommandHandler, ICommandBus } from '../interfaces/index.js';
import { HandlerNotFoundException } from '../exceptions/handler-not-found.exception.js';
import { PipelineOrchestrator } from './pipeline.orchestrator.js';

/**
 * Command bus implementation.
 * Dispatches commands to their handlers through the pipeline.
 */
@Injectable()
export class CommandBus implements ICommandBus {
  private readonly handlers = new Map<string, Type<ICommandHandler<any>>>();

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly pipelineOrchestrator: PipelineOrchestrator,
  ) {}

  /**
   * Send a command to its handler through the pipeline
   * @param command - The command instance
   */
  async send<TCommand extends ICommand>(command: TCommand): Promise<void> {
    const commandName = command.constructor.name;
    const handlerType = this.handlers.get(commandName);

    if (!handlerType) {
      throw new HandlerNotFoundException(commandName, 'command');
    }

    const handler = this.moduleRef.get<ICommandHandler<TCommand>>(handlerType, {
      strict: false,
    });

    // Build and execute pipeline
    const pipeline = this.pipelineOrchestrator.buildPipeline<TCommand, void>(
      command,
      'command',
      () => handler.execute(command)
    );

    await pipeline();
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
    const commandName = command.name;
    if (this.handlers.has(commandName)) {
      throw new Error(
        `Command handler for ${commandName} is already registered`
      );
    }
    this.handlers.set(commandName, handler);
  }

  /**
   * Get registered command names (for debugging)
   */
  getRegisteredCommands(): string[] {
    return Array.from(this.handlers.keys());
  }
}
