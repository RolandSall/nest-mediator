import type { ConnectionPool } from 'mssql';
import type * as mssql from 'mssql';
import { describe, expect, test } from 'vitest';
import { MssqlEventStoreRepository } from '../../src/lib/event-store/repositories/mssql-event-store.repository.js';
import { getPostgresSchema } from '../../src/lib/event-store/schema/postgres.schema.js';
import { getSqlServerSchema } from '../../src/lib/event-store/schema/sqlserver.schema.js';

describe('timezone-aware event-store schemas', () => {
  test('uses timezone-aware columns for newly created tables', () => {
    const postgresSchema = getPostgresSchema('test_events');
    expect(postgresSchema).toMatch(/occurred_at TIMESTAMPTZ NOT NULL/);
    expect(postgresSchema).toMatch(/stored_at TIMESTAMPTZ NOT NULL DEFAULT NOW\(\)/);

    const sqlServerSchema = getSqlServerSchema('test_events');
    expect(sqlServerSchema).toMatch(/occurred_at DATETIMEOFFSET\(7\) NOT NULL/);
    expect(sqlServerSchema).toMatch(/stored_at DATETIMEOFFSET\(7\) NOT NULL/);
    expect(sqlServerSchema).toMatch(
      /DEFAULT TODATETIMEOFFSET\(SYSUTCDATETIME\(\), '\+00:00'\)/,
    );
  });

  test('keeps UTC date binding compatible with legacy SQL Server tables', async () => {
    const boundInputs: Array<{ name: string; type: unknown; value: unknown }> = [];
    const request = {
      input(name: string, type: unknown, value: unknown) {
        boundInputs.push({ name, type, value });
        return this;
      },
      async query(): Promise<void> {},
    };
    const pool = {
      request() {
        return request;
      },
    } as unknown as ConnectionPool;
    const sql = {
      UniqueIdentifier: 'uniqueidentifier',
      NVarChar: (size: unknown) => `nvarchar:${String(size)}`,
      MAX: 'max',
      DateTime2: (scale: number) => `datetime2:${scale}`,
      BigInt: 'bigint',
    } as unknown as typeof mssql;
    const repository = new MssqlEventStoreRepository(pool, sql, 'test_events');
    const timestamp = new Date('2026-08-22T12:34:56.789Z');

    await repository.saveEvent({
      eventId: '00000000-0000-4000-8000-000000000001',
      eventType: 'TimestampTestEvent',
      payload: {},
      occurredAt: timestamp,
      storedAt: timestamp,
    });

    expect(boundInputs.find(({ name }) => name === 'occurred_at')?.type).toBe(
      'datetime2:7',
    );
    expect(boundInputs.find(({ name }) => name === 'stored_at')?.type).toBe(
      'datetime2:7',
    );
  });
});
