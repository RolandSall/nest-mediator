import assert from 'node:assert/strict';

import { MssqlEventStoreRepository } from '../dist/lib/event-store/repositories/mssql-event-store.repository.js';
import { getPostgresSchema } from '../dist/lib/event-store/schema/postgres.schema.js';
import { getSqlServerSchema } from '../dist/lib/event-store/schema/sqlserver.schema.js';

const postgresSchema = getPostgresSchema('test_events');
assert.match(postgresSchema, /occurred_at TIMESTAMPTZ NOT NULL/);
assert.match(postgresSchema, /stored_at TIMESTAMPTZ NOT NULL DEFAULT NOW\(\)/);

const sqlServerSchema = getSqlServerSchema('test_events');
assert.match(sqlServerSchema, /occurred_at DATETIMEOFFSET\(7\) NOT NULL/);
assert.match(sqlServerSchema, /stored_at DATETIMEOFFSET\(7\) NOT NULL/);
assert.match(
  sqlServerSchema,
  /DEFAULT TODATETIMEOFFSET\(SYSUTCDATETIME\(\), '\+00:00'\)/,
);

const boundInputs = [];
const request = {
  input(name, type, value) {
    boundInputs.push({ name, type, value });
    return this;
  },
  async query() {},
};
const pool = {
  request() {
    return request;
  },
};
const sql = {
  UniqueIdentifier: 'uniqueidentifier',
  NVarChar: (size) => `nvarchar:${String(size)}`,
  MAX: 'max',
  DateTime2: (scale) => `datetime2:${scale}`,
  BigInt: 'bigint',
};
const repository = new MssqlEventStoreRepository(pool, sql, 'test_events');
const timestamp = new Date('2026-08-22T12:34:56.789Z');

await repository.saveEvent({
  eventId: '00000000-0000-4000-8000-000000000001',
  eventType: 'TimestampTestEvent',
  payload: {},
  occurredAt: timestamp,
  storedAt: timestamp,
});

assert.equal(
  boundInputs.find(({ name }) => name === 'occurred_at')?.type,
  'datetime2:7',
);
assert.equal(
  boundInputs.find(({ name }) => name === 'stored_at')?.type,
  'datetime2:7',
);
