// ── Utilities ──

export function toKebab(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

export function toPascal(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

interface Field {
  name: string;
  type: string;
}

interface StateField extends Field {
  default?: string;
}

interface Dependency {
  name: string;
  type: string;
}

const LIB = '@nest-mediator/core';

// ── Command ──

export function commandTemplate(name: string, fields: Field[]): string {
  const className = `${toPascal(name)}Command`;
  const fieldLines = fields
    .map((f) => `    public readonly ${f.name}: ${f.type},`)
    .join('\n');

  return `import { ICommand } from '${LIB}';

export class ${className} implements ICommand {
  constructor(
${fieldLines}
  ) {}
}
`;
}

// ── Command handler ──

export function commandHandlerTemplate(
  commandName: string,
  deps: Dependency[],
): string {
  const cmdClass = `${toPascal(commandName)}Command`;
  const handlerClass = `${toPascal(commandName)}Handler`;
  const depImports = deps
    .map((d) => `// import { ${d.type} } from '...';`)
    .join('\n');
  const depParams = deps
    .map((d) => `    private readonly ${d.name}: ${d.type},`)
    .join('\n');

  return `import { Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '${LIB}';
import { ${cmdClass} } from './${toKebab(commandName)}.command';
${depImports}

@Injectable()
@CommandHandler(${cmdClass})
export class ${handlerClass} implements ICommandHandler<${cmdClass}> {
  constructor(
${depParams}
  ) {}

  async execute(command: ${cmdClass}): Promise<void> {
    // TODO: implement ${commandName} logic
  }
}
`;
}

// ── Query ──

export function queryTemplate(
  name: string,
  fields: Field[],
  returnType: string,
): string {
  const className = `${toPascal(name)}Query`;
  const fieldLines = fields
    .map((f) => `    public readonly ${f.name}: ${f.type},`)
    .join('\n');

  return `import { IQuery } from '${LIB}';

export class ${className} implements IQuery {
  constructor(
${fieldLines}
  ) {}
}
`;
}

// ── Query handler ──

export function queryHandlerTemplate(
  queryName: string,
  returnType: string,
  deps: Dependency[],
): string {
  const qClass = `${toPascal(queryName)}Query`;
  const handlerClass = `${toPascal(queryName)}QueryHandler`;
  const depImports = deps
    .map((d) => `// import { ${d.type} } from '...';`)
    .join('\n');
  const depParams = deps
    .map((d) => `    private readonly ${d.name}: ${d.type},`)
    .join('\n');
  const rt = returnType || 'any';

  return `import { Injectable } from '@nestjs/common';
import { QueryHandler, IQueryHandler } from '${LIB}';
import { ${qClass} } from './${toKebab(queryName)}.query';
${depImports}

@Injectable()
@QueryHandler(${qClass})
export class ${handlerClass} implements IQueryHandler<${qClass}, ${rt}> {
  constructor(
${depParams}
  ) {}

  async execute(query: ${qClass}): Promise<${rt}> {
    // TODO: implement ${queryName} query logic
    throw new Error('Not implemented');
  }
}
`;
}

// ── Event ──

export function eventTemplate(
  name: string,
  fields: Field[],
  domainEvent?: { aggregateType: string; aggregateIdField: string },
): string {
  const className = `${toPascal(name)}Event`;
  const fieldLines = fields
    .map((f) => `    public readonly ${f.name}: ${f.type},`)
    .join('\n');

  const imports: string[] = [`import { IEvent } from '${LIB}';`];
  const decorators: string[] = [];

  if (domainEvent) {
    imports.push(`import { DomainEvent } from '${LIB}';`);
    decorators.push(
      `@DomainEvent('${domainEvent.aggregateType}', '${domainEvent.aggregateIdField}')`,
    );
  }

  return `${imports.join('\n')}

${decorators.length ? decorators.join('\n') + '\n' : ''}export class ${className} implements IEvent {
  constructor(
${fieldLines}
  ) {}
}
`;
}

// ── Consumer (non-critical) ──

export function nonCriticalConsumerTemplate(
  consumerName: string,
  eventName: string,
): string {
  const consumerClass = `${toPascal(consumerName)}Consumer`;
  const eventClass = `${toPascal(eventName)}Event`;

  return `import { Injectable } from '@nestjs/common';
import { EventHandler, NonCritical, IEventConsumer } from '${LIB}';
import { ${eventClass} } from '../domain/events/${toKebab(eventName)}.event';

@Injectable()
@EventHandler(${eventClass})
@NonCritical()
export class ${consumerClass} implements IEventConsumer<${eventClass}> {
  async handle(event: ${eventClass}): Promise<void> {
    // TODO: implement ${consumerName} logic
  }
}
`;
}

// ── Consumer (critical) ──

export function criticalConsumerTemplate(
  consumerName: string,
  eventName: string,
  order: number,
  compensationEventName?: string,
): string {
  const consumerClass = `${toPascal(consumerName)}Consumer`;
  const eventClass = `${toPascal(eventName)}Event`;
  const iface = compensationEventName
    ? 'ICriticalEventConsumer'
    : 'IEventConsumer';

  const imports = [
    `import { Injectable } from '@nestjs/common';`,
    `import { EventHandler, Critical, ${iface}${compensationEventName ? ', IEvent' : ''} } from '${LIB}';`,
    `import { ${eventClass} } from '../domain/events/${toKebab(eventName)}.event';`,
  ];

  if (compensationEventName) {
    const compClass = `${toPascal(compensationEventName)}Event`;
    imports.push(
      `import { ${compClass} } from '../domain/events/${toKebab(compensationEventName)}.event';`,
    );
  }

  const compMethod = compensationEventName
    ? `
  async applyCompensatingEvent(event: ${eventClass}): Promise<IEvent> {
    // TODO: return compensating event
    return new ${toPascal(compensationEventName)}Event(/* ... */);
  }
`
    : '';

  return `${imports.join('\n')}

@Injectable()
@EventHandler(${eventClass})
@Critical({ order: ${order} })
export class ${consumerClass} implements ${iface}<${eventClass}> {
  async handle(event: ${eventClass}): Promise<void> {
    // TODO: implement ${consumerName} logic
  }
${compMethod}}
`;
}

// ── Behavior ──

export function behaviorTemplate(
  name: string,
  priority: number,
  scope: 'command' | 'query' | 'all',
  targetType?: string,
): string {
  const className = `${toPascal(name)}Behavior`;
  const handleDecorator = targetType ? '  @Handle()\n' : '';
  const requestType = targetType ? `${toPascal(targetType)}Command` : 'any';
  const requestImport = targetType
    ? `import { ${requestType} } from '../application/${toKebab(targetType)}/${toKebab(targetType)}.command';\n`
    : '';

  return `import { Injectable } from '@nestjs/common';
import { PipelineBehavior${targetType ? ', Handle' : ''}, IPipelineBehavior } from '${LIB}';
${requestImport}
@Injectable()
@PipelineBehavior({ priority: ${priority}, scope: '${scope}' })
export class ${className} implements IPipelineBehavior<${requestType}, any> {
${handleDecorator}  async handle(request: ${requestType}, next: () => Promise<any>): Promise<any> {
    // TODO: implement ${name} behavior logic
    return next();
  }
}
`;
}

// ── Aggregate ──

export function aggregateTemplate(
  name: string,
  idType: string,
  stateFields: StateField[],
  eventNames: string[],
): string {
  const className = `${toPascal(name)}Aggregate`;
  const stateLines = stateFields
    .map((f) => {
      const def = f.default !== undefined ? ` = ${f.default}` : '';
      return `  private _${f.name}: ${f.type}${def};`;
    })
    .join('\n');

  const applyMethods = eventNames
    .map((evtName) => {
      const evtClass = `${toPascal(evtName)}Event`;
      return `
  apply${evtClass}(event: ${evtClass}): void {
    // TODO: update aggregate state from ${evtName}
  }`;
    })
    .join('\n');

  const eventImports = eventNames
    .map(
      (evtName) =>
        `import { ${toPascal(evtName)}Event } from '../events/${toKebab(evtName)}.event';`,
    )
    .join('\n');

  return `import { AggregateRoot } from '${LIB}';
${eventImports}

export class ${className} extends AggregateRoot<${idType}> {
  readonly aggregateType = '${toPascal(name)}';

  private _id!: ${idType};
${stateLines}

  get id(): ${idType} {
    return this._id;
  }
${applyMethods}
}
`;
}

// ── Aggregate repository ──

export function aggregateRepositoryTemplate(
  aggregateName: string,
  idType: string,
): string {
  const aggClass = `${toPascal(aggregateName)}Aggregate`;
  const repoClass = `${toPascal(aggregateName)}AggregateRepository`;

  return `import { Injectable } from '@nestjs/common';
import { ForAggregate, AggregateRepository } from '${LIB}';
import { ${aggClass} } from '../../domain/entities/${toKebab(aggregateName)}.aggregate';

@Injectable()
@ForAggregate(${aggClass})
export class ${repoClass} extends AggregateRepository<${aggClass}, ${idType}> {}
`;
}
