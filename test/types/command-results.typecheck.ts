import {
  ICommand,
  ICommandBus,
  ICommandHandler,
  IMediator,
  MediatorBus,
} from '../../src/index.js';

class LegacyCommand implements ICommand {}
class ResultCommand implements ICommand {}

class LegacyHandler implements ICommandHandler<LegacyCommand> {
  async execute(_command: LegacyCommand): Promise<void> {}
}

class ResultHandler implements ICommandHandler<ResultCommand, string> {
  async execute(_command: ResultCommand): Promise<string> {
    return 'created-id';
  }
}

type Equal<TLeft, TRight> =
  (<T>() => T extends TLeft ? 1 : 2) extends
  (<T>() => T extends TRight ? 1 : 2) ? true : false;
type Expect<T extends true> = T;

declare const commandBus: ICommandBus;
declare const interfaceMediator: IMediator;
declare const mediator: MediatorBus;

const legacyBusResult = commandBus.send(new LegacyCommand());
const explicitLegacyBusResult = commandBus.send<LegacyCommand>(
  new LegacyCommand(),
);
const legacyMediatorResult = mediator.send(new LegacyCommand());
const explicitLegacyMediatorResult = mediator.send<LegacyCommand>(
  new LegacyCommand(),
);
const mediatorResult = mediator.send<string>(new ResultCommand());
const interfaceMediatorResult = interfaceMediator.send<string>(
  new ResultCommand(),
);

type _LegacyBusResultIsVoid = Expect<
  Equal<typeof legacyBusResult, Promise<void>>
>;
type _ExplicitLegacyBusResultIsVoid = Expect<
  Equal<typeof explicitLegacyBusResult, Promise<void>>
>;
type _LegacyMediatorResultIsVoid = Expect<
  Equal<typeof legacyMediatorResult, Promise<void>>
>;
type _ExplicitLegacyMediatorResultIsVoid = Expect<
  Equal<typeof explicitLegacyMediatorResult, Promise<void>>
>;
type _MediatorResultIsString = Expect<
  Equal<typeof mediatorResult, Promise<string>>
>;
type _InterfaceMediatorResultIsString = Expect<
  Equal<typeof interfaceMediatorResult, Promise<string>>
>;

void LegacyHandler;
void ResultHandler;

// The original interface remains implementable with the pre-feature method.
const customLegacyBus: ICommandBus = {
  async send<TCommand extends ICommand>(_command: TCommand): Promise<void> {},
  registerCommandHandler() {},
  getRegisteredCommands() {
    return [];
  },
};

void customLegacyBus;
