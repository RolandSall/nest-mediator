# Migration Guide

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
