/**
 * Event Store Integration Test (ESM)
 *
 * Run with: node test/integration/event-store.integration.mjs
 *
 * Prerequisites:
 * 1. Start PostgreSQL: docker-compose up -d
 * 2. Install dependencies: npm install
 * 3. Build project: npm run build
 */

import 'reflect-metadata';
import pg from 'pg';
const { Pool } = pg;
import { v4 as uuidv4 } from 'uuid';
import { EventStorePersistenceConsumer } from '../../dist/lib/event-store/event-store-persistence.consumer.js';
import { AggregateInfoExtractor } from '../../dist/lib/event-store/aggregate-info.extractor.js';
import { PostgresEventStoreRepository } from '../../dist/lib/event-store/repositories/postgres-event-store.repository.js';
import { getPostgresSchema } from '../../dist/lib/event-store/schema/postgres.schema.js';
import { mediatorContext } from '../../dist/lib/context/mediator-context.js';
import { DomainEvent } from '../../dist/lib/decorators/domain-event.decorator.js';
import { AggregateRoot } from '../../dist/lib/aggregate/aggregate-root.base.js';

// ============================================
// Test Helper
// ============================================

async function createTestRepository(pool, tableName) {
  await pool.query(getPostgresSchema(tableName));
  return new PostgresEventStoreRepository(pool, tableName);
}

// ============================================
// Test Events (apply decorator manually)
// ============================================

class OrderCreatedEvent {
  constructor(orderId, customerId, occurredAt = new Date()) {
    this.orderId = orderId;
    this.customerId = customerId;
    this.occurredAt = occurredAt;
  }
}
DomainEvent('Order', 'orderId')(OrderCreatedEvent);

class OrderItemAddedEvent {
  constructor(orderId, productId, quantity, occurredAt = new Date()) {
    this.orderId = orderId;
    this.productId = productId;
    this.quantity = quantity;
    this.occurredAt = occurredAt;
  }
}
DomainEvent('Order', 'orderId')(OrderItemAddedEvent);

class OrderPlacedEvent {
  constructor(orderId, totalAmount, occurredAt = new Date()) {
    this.orderId = orderId;
    this.totalAmount = totalAmount;
    this.occurredAt = occurredAt;
  }
}
DomainEvent('Order', 'orderId')(OrderPlacedEvent);

// Event without @DomainEvent (for audit mode testing)
class UserLoggedInEvent {
  constructor(userId, ipAddress, occurredAt = new Date()) {
    this.userId = userId;
    this.ipAddress = ipAddress;
    this.occurredAt = occurredAt;
  }
}

// ============================================
// Test Aggregate
// ============================================

class OrderAggregate extends AggregateRoot {
  _id = '';
  _customerId = '';
  _items = new Map();
  _status = 'draft';
  _total = 0;
  aggregateType = 'Order';

  get id() {
    return this._id;
  }

  get customerId() {
    return this._customerId;
  }

  get status() {
    return this._status;
  }

  get total() {
    return this._total;
  }

  static create(orderId, customerId) {
    const order = new OrderAggregate();
    order.apply(new OrderCreatedEvent(orderId, customerId));
    return order;
  }

  addItem(productId, quantity) {
    if (this._status !== 'draft') {
      throw new Error('Cannot modify a placed order');
    }
    this.apply(new OrderItemAddedEvent(this._id, productId, quantity));
  }

  place(totalAmount) {
    if (this._status !== 'draft') {
      throw new Error('Order already placed');
    }
    if (this._items.size === 0) {
      throw new Error('Cannot place an empty order');
    }
    this.apply(new OrderPlacedEvent(this._id, totalAmount));
  }

  // Event handlers
  applyOrderCreatedEvent(event) {
    this._id = event.orderId;
    this._customerId = event.customerId;
    this._status = 'draft';
  }

  applyOrderItemAddedEvent(event) {
    const current = this._items.get(event.productId) ?? 0;
    this._items.set(event.productId, current + event.quantity);
  }

  applyOrderPlacedEvent(event) {
    this._status = 'placed';
    this._total = event.totalAmount;
  }
}

// ============================================
// Test Runner
// ============================================

const DATABASE_URL = 'postgres://mediator:mediator123@localhost:5433/mediator_test';

async function runTests() {
  console.log('='.repeat(60));
  console.log('Event Store Integration Tests');
  console.log('='.repeat(60));
  console.log();

  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    // Test connection
    console.log('Testing database connection...');
    await pool.query('SELECT 1');
    console.log('✓ Database connection successful\n');

    // Run tests
    await testAggregateInfoExtractor();
    await testMediatorContext();
    await testPostgresRepository(pool);
    await testAuditMode(pool);
    await testSourceMode(pool);
    await testAggregateReconstruction(pool);
    await testCausationChain(pool);

    console.log('='.repeat(60));
    console.log('All tests passed! ✓');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// ============================================
// Individual Tests
// ============================================

async function testAggregateInfoExtractor() {
  console.log('Test: AggregateInfoExtractor');
  console.log('-'.repeat(40));

  const extractor = new AggregateInfoExtractor();

  // Test with decorated event
  const orderEvent = new OrderCreatedEvent('order-123', 'customer-456');
  const info = extractor.extract(orderEvent);

  assert(info !== null, 'Should extract info from decorated event');
  assert(info.type === 'Order', `Expected type 'Order', got '${info.type}'`);
  assert(info.id === 'order-123', `Expected id 'order-123', got '${info.id}'`);

  // Test with non-decorated event
  const loginEvent = new UserLoggedInEvent('user-789', '192.168.1.1');
  const noInfo = extractor.extract(loginEvent);

  assert(noInfo === null, 'Should return null for non-decorated event');

  console.log('✓ AggregateInfoExtractor tests passed\n');
}

async function testMediatorContext() {
  console.log('Test: MediatorContext');
  console.log('-'.repeat(40));

  // Test new context creation
  let capturedCorrelationId;
  let capturedCausationId;

  await mediatorContext.runWithNewContext(async () => {
    const ctx = mediatorContext.getContext();
    capturedCorrelationId = ctx.correlationId;
    capturedCausationId = ctx.causationId;

    assert(ctx.correlationId !== undefined, 'Should have correlationId');
    assert(ctx.causationId === undefined, 'Should not have causationId at root');

    // Test nested causation
    await mediatorContext.runWithCausation('event-123', async () => {
      const nestedCtx = mediatorContext.getContext();

      assert(
        nestedCtx.correlationId === capturedCorrelationId,
        'Nested context should inherit correlationId'
      );
      assert(
        nestedCtx.causationId === 'event-123',
        'Nested context should have new causationId'
      );
    });
  });

  // Test isolation between concurrent contexts
  const results = [];

  await Promise.all([
    mediatorContext.runWithNewContext(async () => {
      const ctx = mediatorContext.getContext();
      await new Promise((resolve) => setTimeout(resolve, 10));
      results.push(`A:${ctx.correlationId}`);
    }),
    mediatorContext.runWithNewContext(async () => {
      const ctx = mediatorContext.getContext();
      await new Promise((resolve) => setTimeout(resolve, 5));
      results.push(`B:${ctx.correlationId}`);
    }),
  ]);

  const [resultA, resultB] = results.map((r) => r.split(':')[1]);
  assert(resultA !== resultB, 'Concurrent contexts should have different correlationIds');

  console.log('✓ MediatorContext tests passed\n');
}

async function testPostgresRepository(pool) {
  console.log('Test: PostgresEventStoreRepository');
  console.log('-'.repeat(40));

  const tableName = 'test_events_mjs';

  // Use strategy to create schema and repository
  const repo = await createTestRepository(pool, tableName);
  console.log('  ✓ Schema ensured successfully');

  // Clean up test table
  await pool.query('DELETE FROM test_events_mjs');

  // Test saveEvent
  const event = {
    eventId: uuidv4(),
    eventType: 'TestEvent',
    payload: { message: 'Hello, World!' },
    occurredAt: new Date(),
    storedAt: new Date(),
    status: 'committed',
    correlationId: uuidv4(),
    causationId: undefined,
    metadata: { test: true },
    aggregateType: 'Test',
    aggregateId: 'test-123',
    sequenceNumber: undefined,
  };

  await repo.saveEvent(event);
  console.log('  ✓ Event saved successfully');

  // Test getNextSequence
  const nextSeq = await repo.getNextSequence('Test', 'test-123');
  assert(nextSeq === 1, `Expected next sequence 1, got ${nextSeq}`);
  console.log('  ✓ getNextSequence works correctly');

  // Test markRolledBack
  await repo.markRolledBack(event.eventId);
  const result = await pool.query(
    'SELECT status FROM test_events_mjs WHERE event_id = $1',
    [event.eventId]
  );
  assert(result.rows[0].status === 'rolled_back', 'Event should be marked as rolled_back');
  console.log('  ✓ markRolledBack works correctly');

  console.log('✓ PostgresEventStoreRepository tests passed\n');
}

async function testAuditMode(pool) {
  console.log('Test: Audit Mode');
  console.log('-'.repeat(40));

  const tableName = 'audit_events_mjs';
  const repo = await createTestRepository(pool, tableName);
  await pool.query(`DELETE FROM ${tableName}`);

  const config = {
    type: 'postgres',
    mode: 'audit',
  };

  const consumer = new EventStorePersistenceConsumer(repo, config);

  // Publish events within context
  await mediatorContext.runWithNewContext(async () => {
    // Event with @DomainEvent
    const orderEvent = new OrderCreatedEvent('order-audit-1', 'customer-1');
    await consumer.handle(orderEvent);

    // Event without @DomainEvent
    const loginEvent = new UserLoggedInEvent('user-1', '127.0.0.1');
    await consumer.handle(loginEvent);
  });

  // Verify events were saved
  const result = await pool.query('SELECT * FROM audit_events_mjs ORDER BY stored_at');

  assert(result.rows.length === 2, `Expected 2 events, got ${result.rows.length}`);

  // Check order event
  const orderRow = result.rows[0];
  assert(orderRow.event_type === 'OrderCreatedEvent', 'First event should be OrderCreatedEvent');
  assert(orderRow.aggregate_type === 'Order', 'Should have aggregate_type');
  assert(orderRow.aggregate_id === 'order-audit-1', 'Should have aggregate_id');
  assert(orderRow.sequence_number === null, 'Audit mode should have NULL sequence');
  assert(orderRow.correlation_id !== null, 'Should have correlation_id');

  // Check login event (no aggregate)
  const loginRow = result.rows[1];
  assert(loginRow.event_type === 'UserLoggedInEvent', 'Second event should be UserLoggedInEvent');
  assert(loginRow.aggregate_type === null, 'Non-decorated event should have NULL aggregate_type');

  console.log('✓ Audit Mode tests passed\n');
}

async function testSourceMode(pool) {
  console.log('Test: Source Mode');
  console.log('-'.repeat(40));

  const tableName = 'source_events_mjs';
  const repo = await createTestRepository(pool, tableName);
  await pool.query(`DELETE FROM ${tableName}`);

  const config = {
    type: 'postgres',
    mode: 'source',
  };

  const consumer = new EventStorePersistenceConsumer(repo, config);
  const orderId = 'order-source-1';

  // Publish multiple events for the same aggregate
  await mediatorContext.runWithNewContext(async () => {
    await consumer.handle(new OrderCreatedEvent(orderId, 'customer-1'));
    await consumer.handle(new OrderItemAddedEvent(orderId, 'product-1', 2));
    await consumer.handle(new OrderItemAddedEvent(orderId, 'product-2', 1));
    await consumer.handle(new OrderPlacedEvent(orderId, 150.0));
  });

  // Verify events were saved with sequence numbers
  const result = await pool.query(
    `SELECT * FROM source_events_mjs
     WHERE aggregate_type = 'Order' AND aggregate_id = $1
     ORDER BY sequence_number`,
    [orderId]
  );

  assert(result.rows.length === 4, `Expected 4 events, got ${result.rows.length}`);

  // Verify sequence numbers
  result.rows.forEach((row, index) => {
    assert(
      Number(row.sequence_number) === index + 1,
      `Event ${index} should have sequence ${index + 1}, got ${row.sequence_number}`
    );
  });

  console.log('  ✓ Events saved with correct sequence numbers');

  // Test getEventsForAggregate
  const events = await repo.getEventsForAggregate('Order', orderId);
  assert(events.length === 4, `getEventsForAggregate should return 4 events`);
  assert(events[0].eventType === 'OrderCreatedEvent', 'First event should be OrderCreatedEvent');
  assert(events[3].eventType === 'OrderPlacedEvent', 'Last event should be OrderPlacedEvent');

  console.log('  ✓ getEventsForAggregate returns ordered events');

  console.log('✓ Source Mode tests passed\n');
}

async function testAggregateReconstruction(pool) {
  console.log('Test: Aggregate Reconstruction');
  console.log('-'.repeat(40));

  // Reuse repository from previous test (schema already exists)
  const repo = await createTestRepository(pool, 'source_events_mjs');

  // Get events for the order from previous test
  const orderId = 'order-source-1';
  const storedEvents = await repo.getEventsForAggregate('Order', orderId);

  // Deserialize events
  const eventTypes = {
    OrderCreatedEvent,
    OrderItemAddedEvent,
    OrderPlacedEvent,
  };

  const events = storedEvents.map((stored) => {
    const EventClass = eventTypes[stored.eventType];
    return Object.assign(Object.create(EventClass.prototype), stored.payload);
  });

  // Reconstruct aggregate
  const order = new OrderAggregate();
  order.loadFromHistory(events);

  // Verify state
  assert(order.id === orderId, `Order id should be ${orderId}`);
  assert(order.customerId === 'customer-1', 'Customer id should be customer-1');
  assert(order.status === 'placed', 'Order should be placed');
  assert(order.total === 150.0, 'Total should be 150.0');
  assert(order.version === 4, `Version should be 4, got ${order.version}`);

  console.log('  ✓ Aggregate state reconstructed correctly from events');
  console.log('✓ Aggregate Reconstruction tests passed\n');
}

async function testCausationChain(pool) {
  console.log('Test: Causation Chain');
  console.log('-'.repeat(40));

  const tableName = 'causation_events_mjs';
  const repo = await createTestRepository(pool, tableName);
  await pool.query(`DELETE FROM ${tableName}`);

  const config = {
    type: 'postgres',
    mode: 'audit',
  };

  const consumer = new EventStorePersistenceConsumer(repo, config);
  let rootCorrelationId;

  // Generate valid UUIDs for causation chain
  const causationId1 = uuidv4();
  const causationId2 = uuidv4();

  // Simulate command → event → handler publishes more events
  await mediatorContext.runWithNewContext(async () => {
    rootCorrelationId = mediatorContext.getCorrelationId();

    // Root event (no causation)
    await consumer.handle(new OrderCreatedEvent('order-chain-1', 'customer-1'));

    // Simulate event handler publishing child events
    await mediatorContext.runWithCausation(causationId1, async () => {
      await consumer.handle(new OrderItemAddedEvent('order-chain-1', 'product-1', 1));

      // Nested handler
      await mediatorContext.runWithCausation(causationId2, async () => {
        await consumer.handle(new OrderPlacedEvent('order-chain-1', 50.0));
      });
    });
  });

  // Verify causation chain
  const result = await pool.query(
    `SELECT event_type, correlation_id, causation_id
     FROM causation_events_mjs ORDER BY stored_at`
  );

  assert(result.rows.length === 3, 'Should have 3 events');

  // All should have same correlation_id
  result.rows.forEach((row) => {
    assert(
      row.correlation_id === rootCorrelationId,
      'All events should share the same correlation_id'
    );
  });

  // Check causation chain
  assert(result.rows[0].causation_id === null, 'Root event should have no causation');
  assert(result.rows[1].causation_id === causationId1, 'Second event should have causation UUID');
  assert(result.rows[2].causation_id === causationId2, 'Third event should have causation UUID');

  console.log('  ✓ Correlation IDs match across all events');
  console.log('  ✓ Causation chain correctly tracked');
  console.log('✓ Causation Chain tests passed\n');
}

// ============================================
// Utilities
// ============================================

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

// Run tests
runTests().catch(console.error);
