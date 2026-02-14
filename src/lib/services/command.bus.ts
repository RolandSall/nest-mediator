import { Injectable, Optional, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ICommand, ICommandHandler, ICommandBus } from '../interfaces/index.js';
import { HandlerNotFoundException } from '../exceptions/handler-not-found.exception.js';
import { PipelineOrchestrator } from './pipeline.orchestrator.js';
import { StepEmitter } from '../mediator-flow/step-emitter.js';
import { StepType } from '../mediator-flow/protocol.js';

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
    @Optional() private readonly stepEmitter?: StepEmitter,
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

    this.stepEmitter?.emit(StepType.COMMAND_DISPATCHED, commandName);

    // Build and execute pipeline
    const pipeline = this.pipelineOrchestrator.buildPipeline<TCommand, void>(
      command,
      'command',
      () =>
        this.stepEmitter
          ? this.stepEmitter.wrapAsync(
              StepType.COMMAND_HANDLER_STARTED,
              StepType.COMMAND_HANDLER_COMPLETED,
              StepType.COMMAND_HANDLER_FAILED,
              handlerType.name,
              () => handler.execute(command),
            )
          : handler.execute(command),
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

  /**
   * Get detailed command registrations (for MediatorFlow topology)
   */
  getRegisteredCommandsDetailed(): { commandName: string; handlerName: string }[] {
    return Array.from(this.handlers.entries()).map(([commandName, handlerType]) => ({
      commandName,
      handlerName: handlerType.name,
    }));
  }
}
