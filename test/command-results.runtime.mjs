import assert from 'node:assert/strict';

import { mediatorContext } from '../dist/lib/context/mediator-context.js';
import { CommandBus } from '../dist/lib/services/command.bus.js';

class CreateCommand {}
class CreateHandler {
  async execute() {
    return 'created-id';
  }
}

class LegacyCommand {}
class LegacyHandler {
  async execute() {}
}

const handlers = new Map([
  [CreateHandler, new CreateHandler()],
  [LegacyHandler, new LegacyHandler()],
]);
const moduleRef = {
  get(handlerType) {
    return handlers.get(handlerType);
  },
};
const pipelineOrchestrator = {
  buildPipeline(_command, _scope, handler) {
    return handler;
  },
};

const commandBus = new CommandBus(moduleRef, pipelineOrchestrator);
commandBus.registerCommandHandler(CreateCommand, CreateHandler);
commandBus.registerCommandHandler(LegacyCommand, LegacyHandler);

const createdId = await mediatorContext.runWithNewContext(() =>
  commandBus.send(new CreateCommand()),
);
const legacyResult = await mediatorContext.runWithNewContext(() =>
  commandBus.send(new LegacyCommand()),
);

assert.equal(createdId, 'created-id');
assert.equal(legacyResult, undefined);
