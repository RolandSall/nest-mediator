import type { Pool } from 'pg';
import { DbPool, IDialect, ISchemaManager, loadDriver } from './dialect.interface.js';
import { PostgresSchemaManager } from '../strategies/postgres-schema-manager.js';

/**
 * PostgreSQL dialect. The `pg` driver is imported lazily in `createPool()`.
 */
export class PostgresDialect implements IDialect {
  readonly name = 'postgres';
  readonly schemaManager: ISchemaManager = new PostgresSchemaManager();

  async createPool(url: string): Promise<DbPool> {
    const pg = await loadDriver<{ Pool: new (config: { connectionString: string }) => Pool }>(
      'pg',
      this.name
    );
    // `pg` is CommonJS: the Pool constructor may hang off the default export
    // depending on how the consumer's bundler interops it.
    const PoolCtor = pg.Pool ?? (pg as unknown as { default: typeof pg }).default?.Pool;
    return new PoolCtor({ connectionString: url });
  }

  async closePool(pool: DbPool): Promise<void> {
    await (pool as Pool).end();
  }
}
