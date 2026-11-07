# Changelog

All notable changes to `@nest-mediator/core` are documented in this file.

## 1.3.3 - 2026-11-07

### Added

- Source mode can opt in to `atomicAggregateSave`. The base
  `AggregateRepository` then sends all uncommitted events to `appendEvents()`
  in one batch before dispatching user consumers.

### Source-mode guarantees

- The built-in PostgreSQL and SQL Server repositories use one internal
  database transaction for the complete aggregate append. An insertion failure
  or optimistic-concurrency conflict commits none of the batch.
- User consumers run only after the event batch commits. If a critical consumer
  subsequently fails, the committed source events remain authoritative and the
  aggregate does not retain them as uncommitted.
- `IEventStoreRepository` has no new methods. Its existing `appendEvents()`
  contract now explicitly requires atomic batch persistence and an
  expected-version check in the same transaction.

### Save and dispatch order

- `AggregateRepository.save()` collects every event currently uncommitted by
  the aggregate and passes the complete batch to `appendEvents()` once.
- The event store checks `expectedVersion` and appends the complete batch in
  one transaction. If any insert or the version check fails, the transaction
  rolls back, no consumer runs, and the aggregate retains its uncommitted
  events.
- After the batch commits, the aggregate marks every event committed and
  publishes the events to user consumers sequentially in their original order.
- If a critical consumer fails after commit, `save()` rejects and subsequent
  publication stops. The complete source batch remains committed and the
  aggregate does not restore those authoritative events to its uncommitted
  list.
- Guaranteed post-commit consumer delivery is outside this option's database
  transaction and requires durable subscriber checkpoints or an outbox.

### Source-mode transition

- Atomic aggregate saving is the recommended source-mode path for new
  applications. Per-event persistence remains supported throughout the 1.x
  line and does not emit a runtime deprecation warning.
- Source-mode applications should enable `atomicAggregateSave`, make state
  changes on an aggregate, and persist them through
  `AggregateRepository.save()`. That method appends the aggregate's complete
  uncommitted event batch before dispatching user consumers.
- Direct `mediator.publish()` remains supported in 1.x and keeps its existing
  per-event behavior.
- The planned 2.0 architecture makes atomic aggregate saves the only source
  persistence path and replaces `EventStorePersistenceConsumer` with an
  audit-only `AuditConsumer`. These changes are not applied in this compatible
  1.x release.
- See
  [atomic source aggregate saves](docs/atomic-source-save-example.md) for the
  complete transaction, dispatch, failure, and compatibility behavior.

### Validation

- The repository development and integration-test runtime is now Node.js
  22.22.0 so the Vitest resilience suite can use
  `@integration-testing/testcontainers` with a real PostgreSQL container.
- Added application-level coverage for successful persistence, event-store
  failure, critical-consumer failure and compensation, and non-critical
  consumer failure.
- Added source-mode coverage for atomic two-event aggregate saves, persistence
  failure before dispatch, post-commit consumer failure, and legacy ordering.
- Added integration coverage proving that direct atomic aggregate saves create
  one shared correlation context and existing correlation and causation values
  are preserved across the complete event batch.
- Migrated command-result, timestamp-schema, PostgreSQL, and SQL Server test
  runners from standalone MJS scripts to type-checked TypeScript Vitest tests.
- Added real PostgreSQL and SQL Server rollback coverage that forces the second
  insert in a batch to fail and verifies that the first insert is absent.
- PostgreSQL and SQL Server repository suites now use Testcontainers annotation
  discovery, typed injected resources, and library-owned container cleanup.
- Updated `@integration-testing/testcontainers` to `0.1.0-beta.1` and adopted
  `defineAnnotationProject`, removing consumer-owned annotation global setup.
- Booted the source sample with `atomicAggregateSave` against its PostgreSQL
  container and verified order creation and persisted stream inspection.
- CI installs the packed library as a production dependency and loads it on
  Node.js 18, 20, and 22.

### Backward compatibility

- The published package still supports Node.js 18 and newer. Its
  `engines.node` declaration remains `>=18.0.0`, and library output continues
  to target ES2021.
- Vitest and `@integration-testing/testcontainers` are development-only
  dependencies. They are not installed when an application installs
  `@nest-mediator/core`.
- `atomicAggregateSave` defaults to `false`, so existing source applications
  keep the established per-event persistence and consumer ordering.
- Audit mode and direct publication of non-aggregate events are unchanged.
- Existing event-store schemas need no migration.
- Custom repositories require no new method. They must satisfy the atomic
  `appendEvents()` contract only when an application opts in to atomic
  aggregate saving.

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
