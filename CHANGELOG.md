# Changelog

All notable changes to `@nest-mediator/core` are documented in this file.

## 1.3.2 - 2026-08-23

### Fixed

- Event timestamps now retain explicit timezone semantics in tables created by
  the built-in event stores. JavaScript `Date` values already represent an
  absolute instant, but the previous database column types did not record that
  meaning in the schema.

### Database behavior

- Newly created PostgreSQL event tables use `TIMESTAMPTZ` for `occurred_at`
  and `stored_at`. PostgreSQL stores these as absolute instants and displays
  them using the database session timezone.
- Newly created SQL Server event tables use `DATETIMEOFFSET(7)` with an
  explicit `+00:00` offset. The built-in repository preserves the existing
  UTC parameter behavior for compatibility with older `DATETIME2` tables.

### Backward compatibility

- Schema initialization remains create-only. Existing PostgreSQL `TIMESTAMP`
  and SQL Server `DATETIME2` production tables are not altered automatically
  and remain supported by the built-in repositories.
- `StoredEvent.occurredAt` and `storedAt` remain JavaScript `Date` values; no
  public TypeScript API changed.
- Custom `IEventStoreRepository` implementations and configured table names
  are unaffected.
- Applications can upgrade without a database migration. Installations that
  want existing columns to carry explicit timezone semantics can follow the
  optional, database-specific procedure in
  [the migration guide](https://github.com/RolandSall/nest-mediator/blob/v1.3.2/MIGRATION.md#timezone-aware-event-timestamps).
  PostgreSQL users must identify the timezone that wrote legacy values before
  converting those columns.

### Validation

- Added schema and runtime regression coverage for the new column types and
  SQL Server parameter binding.
- Verified new and legacy schemas against real PostgreSQL and SQL Server
  containers.
- Booted both sample applications against their PostgreSQL containers and
  validated order creation, event persistence, replay, and concurrency.
- Booted the audit sample with its optional SQL Server event store and verified
  that persisted timestamps use `DATETIMEOFFSET` with offset zero.

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
