import type { ConnectionPool } from 'mssql';
import type * as mssql from 'mssql';
import { DbPool, IDialect, ISchemaManager, loadDriver } from './dialect.interface.js';
import { SqlServerSchemaManager } from '../strategies/sqlserver-schema-manager.js';

/**
 * SQL Server dialect. The `mssql` driver is imported lazily in `createPool()`.
 */
export class SqlServerDialect implements IDialect {
  readonly name = 'sqlserver';
  readonly schemaManager: ISchemaManager = new SqlServerSchemaManager();

  async createPool(url: string): Promise<DbPool> {
    const sql = await loadDriver<typeof mssql>('mssql', this.name);
    const driver = (sql as unknown as { default?: typeof mssql }).default ?? sql;
    const pool = new driver.ConnectionPool(url);
    await pool.connect();
    return pool;
  }

  async closePool(pool: DbPool): Promise<void> {
    await (pool as ConnectionPool).close();
  }
}
