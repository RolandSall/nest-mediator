# Migration Guide

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
