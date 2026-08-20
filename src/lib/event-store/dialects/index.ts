import { IDialect } from './dialect.interface.js';
import { PostgresDialect } from './postgres.dialect.js';
import { SqlServerDialect } from './sqlserver.dialect.js';

export { DbPool, IDialect, ISchemaManager, loadDriver } from './dialect.interface.js';
export { PostgresDialect } from './postgres.dialect.js';
export { SqlServerDialect } from './sqlserver.dialect.js';

/**
 * Resolve the dialect for a configured event store `type`.
 *
 * Dialect instances are created eagerly but hold no connection and load no driver —
 * the driver import happens on first `createPool()` call.
 */
export function resolveDialect(type: string): IDialect {
  switch (type) {
    case 'postgres':
      return new PostgresDialect();
    case 'sqlserver':
      return new SqlServerDialect();
    default:
      throw new Error(
        `Unsupported EventStore type: '${type}'. Supported types are: 'postgres', 'sqlserver'`
      );
  }
}
