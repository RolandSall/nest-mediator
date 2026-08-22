# Changelog

All notable changes to `@nest-mediator/core` are documented in this file.

## Unreleased

### Changed

- Newly created PostgreSQL event tables use `TIMESTAMPTZ` for `occurred_at`
  and `stored_at`.
- Newly created SQL Server event tables use `DATETIMEOFFSET(7)` with an
  explicit `+00:00` offset.

### Backward compatibility

- Existing `TIMESTAMP` and `DATETIME2` production tables are not altered and
  remain supported by the built-in repositories.
- `StoredEvent.occurredAt` and `storedAt` remain JavaScript `Date` values; no
  public TypeScript API changed.
- Added an optional migration guide for installations that want to upgrade
  existing timestamp columns.

## 1.3.1 - 2026-08-22

### Added

- Command handlers can optionally return a value. Declare the handler as
  `ICommandHandler<MyCommand, TResult>` and call it with
  `mediator.send<TResult>(command)`.
- Added the command-result overload directly to `IMediator` and `MediatorBus`.
- Added compile-time and runtime compatibility coverage for command results.

### Backward compatibility

- Existing `ICommandHandler<MyCommand>` implementations still default to
  `Promise<void>` and require no changes.
- Existing `send(command)` and `send<MyCommand>(command)` calls still resolve to
  `Promise<void>`. The original command-type generic remains supported.
- The original `ICommandBus` contract is unchanged, so custom command bus
  implementations continue to compile.
- Commands still implement the unchanged `ICommand` marker interface.
- Pipelines now forward a command handler's resolved value. Void handlers still
  resolve to `undefined`, as before.
- Custom pipeline behaviors used with a result-returning command must return
  the value from `next()`. The built-in behaviors already do this.

### Migration

No migration is required. To opt in for a particular command:

```typescript
class CreateOrderHandler
  implements ICommandHandler<CreateOrderCommand, string> {
  async execute(command: CreateOrderCommand): Promise<string> {
    const orderId = await this.orders.create(command);
    return orderId;
  }
}

const orderId = await mediator.send<string>(new CreateOrderCommand());
```

The caller-provided result type must match the handler's declared result type;
the command marker does not encode or infer it.

## 1.3.0 - 2026-08-20

### Added

- Added SQL Server and Azure SQL support for audit and event-sourcing modes,
  alongside the existing PostgreSQL support.
- Added SQL Server schema management, persistence, and integration coverage.
- Added an optional SQL Server service and setup instructions for the audit
  example.
