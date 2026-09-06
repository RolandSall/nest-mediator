import type { ModuleRef } from '@nestjs/core';
import { describe, expect, test } from 'vitest';
import { mediatorContext } from '../../src/lib/context/mediator-context.js';
import { CommandBus } from '../../src/lib/services/command.bus.js';
import type { PipelineOrchestrator } from '../../src/lib/services/pipeline.orchestrator.js';

class CreateCommand {}

class CreateHandler {
  async execute(): Promise<string> {
    return 'created-id';
  }
}

class LegacyCommand {}

class LegacyHandler {
  async execute(): Promise<void> {}
}

describe('command results', () => {
  test('returns handler results while preserving void command behavior', async () => {
    const handlers = new Map<Function, object>([
      [CreateHandler, new CreateHandler()],
      [LegacyHandler, new LegacyHandler()],
    ]);
    const moduleRef = {
      get(handlerType: Function): object | undefined {
        return handlers.get(handlerType);
      },
    } as unknown as ModuleRef;
    const pipelineOrchestrator = {
      buildPipeline<T>(
        _command: unknown,
        _scope: unknown,
        handler: () => Promise<T>,
      ): () => Promise<T> {
        return handler;
      },
    } as PipelineOrchestrator;

    const commandBus = new CommandBus(moduleRef, pipelineOrchestrator);
    commandBus.registerCommandHandler(CreateCommand, CreateHandler);
    commandBus.registerCommandHandler(LegacyCommand, LegacyHandler);

    const createdId = await mediatorContext.runWithNewContext(() =>
      commandBus.send<string>(new CreateCommand()),
    );
    const legacyResult = await mediatorContext.runWithNewContext(() =>
      commandBus.send(new LegacyCommand()),
    );

    expect(createdId).toBe('created-id');
    expect(legacyResult).toBeUndefined();
  });
});
