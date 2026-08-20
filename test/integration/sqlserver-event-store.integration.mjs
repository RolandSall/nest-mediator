/**
 * SQL Server Event Store Integration Test (ESM)
 *
 * Run with: node test/integration/sqlserver-event-store.integration.mjs
 *
 * Prerequisites:
 * 1. Docker must be running (testcontainers spins up SQL Server automatically),
 *    OR set MSSQL_TEST_URL to point at an existing SQL Server.
 * 2. Install dependencies: npm install
 * 3. Build project: npm run build
 *
 * Note: the official SQL Server image is amd64-only. On Apple Silicon the container
 * runs under emulation, which is slow but works.
 */

import assert from 'node:assert';
import { v4 as uuidv4 } from 'uuid';
import { GenericContainer, Wait } from 'testcontainers';
import { SqlServerDialect } from '../../dist/lib/event-store/dialects/sqlserver.dialect.js';
import { ConcurrencyError } from '../../dist/lib/interfaces/event-store.interface.js';

const SA_PASSWORD = 'NestMediator!2026';

// ============================================
// Test Helpers
// ============================================

function buildUrl(host, port, database = 'master') {
  return (
    `Server=${host},${port};Database=${database};User Id=sa;Password=${SA_PASSWORD};` +
    'Encrypt=false;TrustServerCertificate=true'
  );
}

function makeEvent(overrides = {}) {
  const now = new Date();
  return {
    eventId: uuidv4(),
    eventType: 'OrderCreatedEvent',
    payload: { orderId: 'order-1', customerId: 'cust-1' },
    occurredAt: now,
    storedAt: now,
    correlationId: uuidv4(),
    causationId: undefined,
    metadata: { source: 'test' },
    aggregateType: undefined,
    aggregateId: undefined,
    sequenceNumber: undefined,
    ...overrides,
  };
}

let passed = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (error) {
    console.error(`  FAIL  ${name}`);
    console.error(`        ${error.message}`);
    process.exitCode = 1;
  }
}

// ============================================
// Suite
// ============================================

async function main() {
  let container;
  let baseUrl = process.env.MSSQL_TEST_URL;

  if (!baseUrl) {
    console.log('Starting SQL Server container (amd64; slow under emulation)...');
    container = await new GenericContainer('mcr.microsoft.com/mssql/server:2022-latest')
      .withPlatform('linux/amd64')
      .withEnvironment({ ACCEPT_EULA: 'Y', MSSQL_SA_PASSWORD: SA_PASSWORD })
      .withExposedPorts(1433)
      .withWaitStrategy(Wait.forLogMessage(/SQL Server is now ready for client connections/))
      .withStartupTimeout(300000)
      .start();
    baseUrl = buildUrl(container.getHost(), container.getMappedPort(1433));
  } else {
    console.log('Using MSSQL_TEST_URL');
  }

  const dialect = new SqlServerDialect();

  // Ensure a dedicated database exists, then reconnect to it.
  const adminPool = await dialect.createPool(baseUrl);
  await adminPool.request().batch("IF DB_ID('mediator_it') IS NULL CREATE DATABASE mediator_it;");
  await dialect.closePool(adminPool);

  const url = baseUrl.replace(/Database=[^;]*/, 'Database=mediator_it');
  const pool = await dialect.createPool(url);

  const table = `it_events_${Date.now()}`;
  await dialect.schemaManager.ensureSchema(pool, table);
  const repo = dialect.schemaManager.createRepository(
    { type: 'sqlserver', tableName: table },
    pool,
    false
  );

  console.log(`\nSQL Server event store — table ${table}\n`);

  // ---------- AUDIT MODE ----------
  await test('audit: saveEvent persists a row', async () => {
    const event = makeEvent();
    await repo.saveEvent(event);
    const res = await pool
      .request()
      .query(`SELECT COUNT(*) AS c FROM ${table} WHERE event_id = '${event.eventId}'`);
    assert.strictEqual(res.recordset[0].c, 1, 'expected exactly one row');
  });

  await test('audit: payload and metadata round-trip as JSON', async () => {
    const event = makeEvent({ payload: { nested: { a: 1 }, list: [1, 2, 3] } });
    await repo.saveEvent(event);
    const res = await pool
      .request()
      .query(`SELECT payload, metadata FROM ${table} WHERE event_id = '${event.eventId}'`);
    const payload = JSON.parse(res.recordset[0].payload);
    assert.deepStrictEqual(payload, { nested: { a: 1 }, list: [1, 2, 3] });
    assert.deepStrictEqual(JSON.parse(res.recordset[0].metadata), { source: 'test' });
  });

  await test('audit: null correlation/causation are accepted', async () => {
    const event = makeEvent({ correlationId: undefined, causationId: undefined });
    await repo.saveEvent(event);
    const res = await pool
      .request()
      .query(`SELECT correlation_id FROM ${table} WHERE event_id = '${event.eventId}'`);
    assert.strictEqual(res.recordset[0].correlation_id, null);
  });

  // ---------- SOURCE MODE ----------
  await test('source: getNextSequence starts at 1 for a new aggregate', async () => {
    const next = await repo.getNextSequence('Order', `new-${uuidv4()}`);
    assert.strictEqual(next, 1, `expected 1, got ${next}`);
  });

  await test('source: appendEvents assigns incrementing sequences', async () => {
    const id = `order-${uuidv4()}`;
    await repo.appendEvents('Order', id, [makeEvent(), makeEvent()], 0);
    const events = await repo.getEventsForAggregate('Order', id);
    assert.strictEqual(events.length, 2, `expected 2 events, got ${events.length}`);
    assert.deepStrictEqual(
      events.map((e) => e.sequenceNumber),
      [1, 2],
      'sequences should be 1,2'
    );
  });

  await test('source: replay returns events in sequence order with parsed payload', async () => {
    const id = `order-${uuidv4()}`;
    await repo.appendEvents(
      'Order',
      id,
      [makeEvent({ payload: { step: 1 } }), makeEvent({ payload: { step: 2 } })],
      0
    );
    const events = await repo.getEventsForAggregate('Order', id);
    assert.deepStrictEqual(events.map((e) => e.payload.step), [1, 2]);
    assert.strictEqual(events[0].aggregateType, 'Order');
    assert.strictEqual(events[0].aggregateId, id);
  });

  await test('source: appending onto an existing aggregate continues the sequence', async () => {
    const id = `order-${uuidv4()}`;
    await repo.appendEvents('Order', id, [makeEvent()], 0);
    await repo.appendEvents('Order', id, [makeEvent()], 1);
    const events = await repo.getEventsForAggregate('Order', id);
    assert.deepStrictEqual(events.map((e) => e.sequenceNumber), [1, 2]);
  });

  await test('source: stale expectedVersion raises ConcurrencyError', async () => {
    const id = `order-${uuidv4()}`;
    await repo.appendEvents('Order', id, [makeEvent()], 0);
    await assert.rejects(
      () => repo.appendEvents('Order', id, [makeEvent()], 0),
      (err) => {
        assert.ok(err instanceof ConcurrencyError, `expected ConcurrencyError, got ${err.name}`);
        assert.strictEqual(err.expectedVersion, 0);
        assert.strictEqual(err.actualVersion, 1);
        return true;
      }
    );
  });

  await test('source: concurrent appends — exactly one wins, loser gets ConcurrencyError', async () => {
    const id = `order-${uuidv4()}`;
    const results = await Promise.allSettled([
      repo.appendEvents('Order', id, [makeEvent()], 0),
      repo.appendEvents('Order', id, [makeEvent()], 0),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected');
    assert.strictEqual(ok.length, 1, `expected exactly 1 success, got ${ok.length}`);
    assert.strictEqual(failed.length, 1, `expected exactly 1 failure, got ${failed.length}`);
    assert.ok(
      failed[0].reason instanceof ConcurrencyError,
      `loser must get ConcurrencyError, got ${failed[0].reason?.name}: ${failed[0].reason?.message}`
    );
    const events = await repo.getEventsForAggregate('Order', id);
    assert.strictEqual(events.length, 1, 'only the winner should have persisted');
  });

  await test('source: sequenced and unsequenced events coexist in one table', async () => {
    const id = `order-${uuidv4()}`;
    await repo.saveEvent(makeEvent());
    await repo.saveEvent(makeEvent());
    await repo.appendEvents('Order', id, [makeEvent()], 0);
    const events = await repo.getEventsForAggregate('Order', id);
    assert.strictEqual(events.length, 1, 'audit rows must not leak into aggregate replay');
  });

  await dialect.closePool(pool);
  if (container) await container.stop();

  console.log(`\n${passed} passed${process.exitCode ? ', SOME FAILED' : ', all green'}`);
}

main().catch((error) => {
  console.error('SUITE FAILED:', error);
  process.exit(1);
});
