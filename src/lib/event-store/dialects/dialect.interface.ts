import { EventStoreConfig, IEventStoreRepository } from '../../interfaces/index.js';

/**
 * An opaque database connection pool.
 *
 * The event store deliberately does not name a concrete driver type here — each
 * dialect knows how to narrow this to its own pool (`pg.Pool`, `mssql.ConnectionPool`).
 * Keeping it opaque is what allows the library to be installed with only one driver.
 */
export type DbPool = unknown;

/**
 * Everything the event store needs to talk to one specific database engine.
 *
 * Drivers are loaded lazily inside `createPool()` so that importing this library
 * never pulls a database driver into the require graph. A user running in Simple
 * mode needs no driver at all; a PostgreSQL user needs only `pg`; a SQL Server
 * user needs only `mssql`.
 */
export interface IDialect {
  /** Human-readable name, used in error messages. */
  readonly name: string;

  /** Create a pool from a connection URL. Loads the underlying driver on first call. */
  createPool(url: string): Promise<DbPool>;

  /** Close a pool this dialect created. */
  closePool(pool: DbPool): Promise<void>;

  /** Creates the schema and builds the repository for this engine. */
  readonly schemaManager: ISchemaManager;
}

/**
 * Schema manager interface for database schema operations.
 */
export interface ISchemaManager {
  ensureSchema(pool: DbPool, tableName?: string): Promise<void>;
  createRepository(
    config: EventStoreConfig,
    pool: DbPool,
    ownsPool: boolean
  ): IEventStoreRepository;
}

/**
 * Load an optional database driver, failing with an actionable message instead of
 * a raw MODULE_NOT_FOUND if the user has not installed it.
 */
export async function loadDriver<T>(
  moduleName: string,
  dialectName: string
): Promise<T> {
  try {
    return (await import(moduleName)) as T;
  } catch {
    throw new Error(
      `EventStore type: '${dialectName}' requires the '${moduleName}' package, ` +
        `which is not installed. Install it with: npm install ${moduleName}`
    );
  }
}
