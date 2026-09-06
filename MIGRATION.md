# Migration Guide

## Atomic source aggregate saves

No migration is required. Existing source-mode applications retain their
current behavior unless they explicitly enable the option:

```typescript
NestMediatorModule.forRoot({
  eventStore: {
    type: 'postgres',
    url: process.env.DATABASE_URL,
    mode: 'source',
    atomicAggregateSave: true,
  },
});
```

The enabled flow is:

1. Collect all events currently uncommitted by the aggregate.
2. Check the expected version and append all events in one event-store
   transaction.
3. Mark the aggregate events committed after the database commits.
4. Dispatch critical and non-critical user consumers without running event
   persistence again.

This changes source-mode timing intentionally. All events from the aggregate
operation are visible when the first user consumer runs. If a critical user
consumer fails, `save()` rejects but the source events remain committed and do
not return to the aggregate's uncommitted list.

Applications providing a custom `IEventStoreRepository` must ensure that
`appendEvents()` commits the complete supplied batch or none of it. The
expected-version check must occur in that same transaction. No new repository
method or database schema change is required.

### Transition from per-event source persistence

Atomic aggregate saving is recommended for new source-mode applications.
Per-event persistence remains supported without a runtime warning throughout
the 1.x line.

The planned 2.0 architecture makes `AggregateRepository.save()` the sole
source-mode persistence entry point and replaces
`EventStorePersistenceConsumer` with an audit-only `AuditConsumer`. Neither
change is made in this compatible 1.x release.

To migrate:

1. Enable `atomicAggregateSave: true` in the source-mode event-store options.
2. Record state changes through an `AggregateRoot`.
3. Persist the aggregate with `AggregateRepository.save()`.
4. Do not call `mediator.publish()` directly for the aggregate's uncommitted
   domain events. `AggregateRepository.save()` persists and dispatches them.

Existing applications do not need to migrate immediately. Audit mode and
direct event publication require no changes in 1.x.

## Timezone-aware event timestamps

New event-store tables use timezone-aware timestamp columns:

- PostgreSQL: `TIMESTAMPTZ`
- SQL Server: `DATETIMEOFFSET(7)` with offset `+00:00`

Existing tables are never changed automatically. The built-in repositories
continue to support the previous PostgreSQL `TIMESTAMP` and SQL Server
`DATETIME2` columns, so upgrading the package requires no database migration.

Only run the following migrations if you want existing database columns to
carry explicit timezone semantics. Back up the table and validate representative
rows before migrating.

### PostgreSQL

You must know which timezone the Node process used when it wrote the legacy
rows. If it ran with `TZ=UTC`, migrate with:

```sql
BEGIN;

ALTER TABLE domain_events
  ALTER COLUMN occurred_at TYPE TIMESTAMPTZ
    USING occurred_at AT TIME ZONE 'UTC',
  ALTER COLUMN stored_at TYPE TIMESTAMPTZ
    USING stored_at AT TIME ZONE 'UTC';

COMMIT;
```

If the process used another timezone, replace `UTC` with its IANA timezone,
for example `Asia/Beirut`. Using a region name preserves historical daylight
saving rules better than using a fixed numeric offset.

### SQL Server

The built-in SQL Server driver writes UTC clock fields by default. When the
legacy `DATETIME2` values are known to represent UTC, use:

```sql
ALTER TABLE domain_events
  DROP CONSTRAINT DF_domain_events_stored_at;

ALTER TABLE domain_events
  ALTER COLUMN occurred_at DATETIMEOFFSET(7) NOT NULL;

ALTER TABLE domain_events
  ALTER COLUMN stored_at DATETIMEOFFSET(7) NOT NULL;

ALTER TABLE domain_events
  ADD CONSTRAINT DF_domain_events_stored_at
  DEFAULT TODATETIMEOFFSET(SYSUTCDATETIME(), '+00:00') FOR stored_at;
```

This conversion assigns `+00:00` to the existing clock values. If an existing
pool was configured with `useUTC: false`, determine the original timezone and
use a staged migration with `TODATETIMEOFFSET` instead of running this script.

Replace `domain_events` and the default-constraint name if you configured a
custom `tableName`.

## `@rolandsall24/nest-mediator` → `@nest-mediator/core`

The package was renamed from a personal scope to a project scope. **This is a rename only — there are no API changes, no behavior changes, and no code changes.** Every export, decorator, class, and option is identical.

npm has no rename mechanism, so `@nest-mediator/core` is published as a new package and `@rolandsall24/nest-mediator` is deprecated. The old package keeps working — existing installs will not break — but it will not receive new versions.

### Version mapping

| Old | New |
|---|---|
| `@rolandsall24/nest-mediator@1.2.0` | `@nest-mediator/core@1.2.0` |

Versions continue from where the old package left off, so `1.2.0` on the old name and `1.2.0` on the new name are the same code. Future releases happen only under `@nest-mediator/core`.

### Steps

**1. Swap the dependency**

```bash
npm uninstall @rolandsall24/nest-mediator
npm install @nest-mediator/core
```

**2. Update your imports**

```diff
- import { NestMediatorModule, MediatorBus } from '@rolandsall24/nest-mediator';
+ import { NestMediatorModule, MediatorBus } from '@nest-mediator/core';
```

Or run this codemod from your project root to rewrite every import at once:

```bash
# macOS
grep -rl '@rolandsall24/nest-mediator' --exclude-dir=node_modules . \
  | xargs sed -i '' 's|@rolandsall24/nest-mediator|@nest-mediator/core|g'

# Linux
grep -rl '@rolandsall24/nest-mediator' --exclude-dir=node_modules . \
  | xargs sed -i 's|@rolandsall24/nest-mediator|@nest-mediator/core|g'
```

**3. Update `tsconfig.json` path mappings, if you have any**

```diff
  "paths": {
-   "@rolandsall24/nest-mediator": ["..."],
-   "@rolandsall24/nest-mediator/*": ["..."]
+   "@nest-mediator/core": ["..."],
+   "@nest-mediator/core/*": ["..."]
  }
```

**4. Check for leftovers**

```bash
grep -r '@rolandsall24/nest-mediator' --exclude-dir=node_modules .
```

Should return nothing. Don't forget `Dockerfile`s, CI configs, and lockfiles — re-run `npm install` to regenerate `package-lock.json`.

### What is *not* affected

- **The MediatorFlow dashboard image** is still `rolandsall24/mediatorflow` on Docker Hub. That is a Docker Hub repository, not an npm package, and it was not renamed. Leave your `docker run` / `docker-compose.yml` references as they are.
- **Database schemas, event store tables, and persisted events** are untouched. No migration needed.
- **The GitHub repository** remains [RolandSall/nest-mediator](https://github.com/RolandSall/nest-mediator).

### Troubleshooting

**`Cannot find module '@nest-mediator/core'`** — delete `node_modules` and `package-lock.json`, then `npm install`.

**Both packages installed at once** — TypeScript may resolve decorators from two different copies of the library, and `instanceof` checks across them will fail. Make sure `@rolandsall24/nest-mediator` is fully removed:

```bash
npm ls @rolandsall24/nest-mediator
```
