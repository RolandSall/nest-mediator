/**
 * Event Store Integration Test
 *
 * This file demonstrates and tests the event store functionality.
 * Run with: npx tsx test/integration/event-store.integration.ts
 *
 * Prerequisites:
 * 1. Start PostgreSQL: docker-compose up -d
 * 2. Install dependencies: npm install
 */

import 'reflect-metadata';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { PostgresEventStoreRepository } from '../../src/lib/event-store/repositories/postgres-event-store.repository';
import { EventStorePersistenceConsumer } from '../../src/lib/event-store/event-store-persistence.consumer';
import { AggregateInfoExtractor } from '../../src/lib/event-store/aggregate-info.extractor';
import { mediatorContext } from '../../src/lib/context/mediator-context';
import { DomainEvent } from '../../src/lib/decorators/domain-event.decorator';
import { IEvent, EventStoreConfig, StoredEvent } from '../../src/lib/interfaces/index';
import { AggregateRoot } from '../../src/lib/aggregate/aggregate-root.base';
import { getPostgresSchema } from '../../src/lib/event-store/schema/postgres.schema';

// ============================================
// Test Events
// ============================================

@DomainEvent('Order', 'orderId')
class OrderCreatedEvent implements IEvent {
  constructor(
    public readonly orderId: string,
    public readonly customerId: string,
    public readonly occurredAt: Date = new Date()
  ) {}
}

@DomainEvent('Order', 'orderId')
class OrderItemAddedEvent implements IEvent {
  constructor(
    public readonly orderId: string,
    public readonly productId: string,
    public readonly quantity: number,
    public readonly occurredAt: Date = new Date()
  ) {}
}

@DomainEvent('Order', 'orderId')
class OrderPlacedEvent implements IEvent {
  constructor(
    public readonly orderId: string,
    public readonly totalAmount: number,
    public readonly occurredAt: Date = new Date()
  ) {}
}

// Event without @DomainEvent (for audit mode testing)
class UserLoggedInEvent implements IEvent {
  constructor(
    public readonly userId: string,
    public readonly ipAddress: string,
    public readonly occurredAt: Date = new Date()
  ) {}
}

// ============================================
// Test Aggregate
// ============================================

class OrderAggregate extends AggregateRoot<string> {
  private _id: string = '';
  private _customerId: string = '';
  private _items: Map<string, number> = new Map();
  private _status: 'draft' | 'placed' = 'draft';
  private _total: number = 0;

  readonly aggregateType = 'Order';

  get id(): string {
    return this._id;
  }

  get customerId(): string {
    return this._customerId;
  }

  get status(): string {
    return this._status;
  }

  get total(): number {
    return this._total;
  }

  static create(orderId: string, customerId: string): OrderAggregate {
    const order = new OrderAggregate();
    order.apply(new OrderCreatedEvent(orderId, customerId));
    return order;
  }

  addItem(productId: string, quantity: number): void {
    if (this._status !== 'draft') {
      throw new Error('Cannot modify a placed order');
    }
    this.apply(new OrderItemAddedEvent(this._id, productId, quantity));
  }

  place(totalAmount: number): void {
    if (this._status !== 'draft') {
      throw new Error('Order already placed');
    }
    if (this._items.size === 0) {
      throw new Error('Cannot place an empty order');
    }
    this.apply(new OrderPlacedEvent(this._id, totalAmount));
  }

  // Event handlers
  applyOrderCreatedEvent(event: OrderCreatedEvent): void {
    this._id = event.orderId;
    this._customerId = event.customerId;
    this._status = 'draft';
  }

  applyOrderItemAddedEvent(event: OrderItemAddedEvent): void {
    const current = this._items.get(event.productId) ?? 0;
    this._items.set(event.productId, current + event.quantity);
  }

  applyOrderPlacedEvent(event: OrderPlacedEvent): void {
    this._status = 'placed';
    this._total = event.totalAmount;
  }
}

// ============================================
// Test Runner
// ============================================

const DATABASE_URL = 'postgres://mediator:mediator123@localhost:5433/mediator_test';

/**
 * Create the schema for a given table using the library's schema generator.
 */
async function ensureSchema(pool: Pool, tableName: string): Promise<void> {
  const schema = getPostgresSchema(tableName);
  await pool.query(schema);
}

async function runTests(): Promise<void> {
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

async function testAggregateInfoExtractor(): Promise<void> {
  console.log('Test: AggregateInfoExtractor');
  console.log('-'.repeat(40));

  const extractor = new AggregateInfoExtractor();

  // Test with decorated event
  const orderEvent = new OrderCreatedEvent('order-123', 'customer-456');
  const info = extractor.extract(orderEvent);

  assert(info !== null, 'Should extract info from decorated event');
  assert(info!.type === 'Order', `Expected type 'Order', got '${info!.type}'`);
  assert(info!.id === 'order-123', `Expected id 'order-123', got '${info!.id}'`);

  // Test with non-decorated event
  const loginEvent = new UserLoggedInEvent('user-789', '192.168.1.1');
  const noInfo = extractor.extract(loginEvent);

  assert(noInfo === null, 'Should return null for non-decorated event');

  console.log('✓ AggregateInfoExtractor tests passed\n');
}

async function testMediatorContext(): Promise<void> {
  console.log('Test: MediatorContext');
  console.log('-'.repeat(40));

  // Test new context creation
  let capturedCorrelationId: string | undefined;
  let capturedCausationId: string | undefined;

  await mediatorContext.runWithNewContext(async () => {
    const ctx = mediatorContext.getContext();
    capturedCorrelationId = ctx.correlationId;
    capturedCausationId = ctx.causationId;

    assert(ctx.correlationId !== undefined, 'Should have correlationId');
    assert(ctx.causationId === undefined, 'Should not have causationId at root');

    // Test nested causation
    // runWithCausation sets currentEventId to the given eventId,
    // and causationId to the parent's currentEventId (undefined at root).
    await mediatorContext.runWithCausation('event-123', async () => {
      const nestedCtx = mediatorContext.getContext();

      assert(
        nestedCtx.correlationId === capturedCorrelationId,
        'Nested context should inherit correlationId'
      );
      assert(
        nestedCtx.currentEventId === 'event-123',
        'Nested context should have currentEventId set to the event being processed'
      );
      assert(
        nestedCtx.causationId === undefined,
        'Causation should be undefined (parent root has no currentEventId)'
      );

      // Double-nested: the child's causationId should be the parent's currentEventId
      await mediatorContext.runWithCausation('event-456', async () => {
        const deepCtx = mediatorContext.getContext();

        assert(
          deepCtx.correlationId === capturedCorrelationId,
          'Deep nested context should inherit correlationId'
        );
        assert(
          deepCtx.currentEventId === 'event-456',
          'Deep nested context should have its own currentEventId'
        );
        assert(
          deepCtx.causationId === 'event-123',
          'Deep nested causationId should be parent currentEventId'
        );
      });
    });
  });

  // Test isolation between concurrent contexts
  const results: string[] = [];

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

async function testPostgresRepository(pool: Pool): Promise<void> {
  console.log('Test: PostgresEventStoreRepository');
  console.log('-'.repeat(40));

  const tableName = 'test_events';
  await ensureSchema(pool, tableName);
  console.log('  ✓ Schema created successfully');

  await pool.query(`DELETE FROM ${tableName}`);

  const repo = new PostgresEventStoreRepository(pool, tableName, false);

  // Test saveEvent
  const event: StoredEvent = {
    eventId: uuidv4(),
    eventType: 'TestEvent',
    payload: { message: 'Hello, World!' },
    occurredAt: new Date(),
    storedAt: new Date(),
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

  // Test getEventsForAggregate (should be empty — event has no sequence_number)
  const events = await repo.getEventsForAggregate('Test', 'test-123');
  assert(events.length === 0, `Expected 0 sequenced events, got ${events.length}`);
  console.log('  ✓ getEventsForAggregate filters non-sequenced events correctly');

  console.log('✓ PostgresEventStoreRepository tests passed\n');
}

async function testAuditMode(pool: Pool): Promise<void> {
  console.log('Test: Audit Mode');
  console.log('-'.repeat(40));

  const tableName = 'audit_events';
  await ensureSchema(pool, tableName);
  await pool.query(`DELETE FROM ${tableName}`);

  const repo = new PostgresEventStoreRepository(pool, tableName, false);

  const config: EventStoreConfig = {
    type: 'postgres',
    mode: 'audit',
  };

  const consumer = new EventStorePersistenceConsumer(repo, config);

  await mediatorContext.runWithNewContext(async () => {
    const orderEvent = new OrderCreatedEvent('order-audit-1', 'customer-1');
    await consumer.handle(orderEvent);

    const loginEvent = new UserLoggedInEvent('user-1', '127.0.0.1');
    await consumer.handle(loginEvent);
  });

  const result = await pool.query(`SELECT * FROM ${tableName} ORDER BY stored_at`);

  assert(result.rows.length === 2, `Expected 2 events, got ${result.rows.length}`);

  const orderRow = result.rows[0];
  assert(orderRow.event_type === 'OrderCreatedEvent', 'First event should be OrderCreatedEvent');
  assert(orderRow.aggregate_type === 'Order', 'Should have aggregate_type');
  assert(orderRow.aggregate_id === 'order-audit-1', 'Should have aggregate_id');
  assert(orderRow.sequence_number === null, 'Audit mode should have NULL sequence');
  assert(orderRow.correlation_id !== null, 'Should have correlation_id');

  const loginRow = result.rows[1];
  assert(loginRow.event_type === 'UserLoggedInEvent', 'Second event should be UserLoggedInEvent');
  assert(loginRow.aggregate_type === null, 'Non-decorated event should have NULL aggregate_type');

  console.log('✓ Audit Mode tests passed\n');
}

async function testSourceMode(pool: Pool): Promise<void> {
  console.log('Test: Source Mode');
  console.log('-'.repeat(40));

  const tableName = 'source_events';
  await ensureSchema(pool, tableName);
  await pool.query(`DELETE FROM ${tableName}`);

  const repo = new PostgresEventStoreRepository(pool, tableName, false);

  const config: EventStoreConfig = {
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
    `SELECT * FROM ${tableName}
     WHERE aggregate_type = 'Order' AND aggregate_id = $1
     ORDER BY sequence_number`,
    [orderId]
  );

  assert(result.rows.length === 4, `Expected 4 events, got ${result.rows.length}`);

  // Verify sequence numbers (convert to number in case of string from DB)
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

async function testAggregateReconstruction(pool: Pool): Promise<void> {
  console.log('Test: Aggregate Reconstruction');
  console.log('-'.repeat(40));

  const repo = new PostgresEventStoreRepository(pool, 'source_events', false);

  // Get events for the order from previous test
  const orderId = 'order-source-1';
  const storedEvents = await repo.getEventsForAggregate('Order', orderId);

  // Deserialize events (simulate repository)
  const eventTypes: Record<string, new (...args: any[]) => IEvent> = {
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

async function testCausationChain(pool: Pool): Promise<void> {
  console.log('Test: Causation Chain');
  console.log('-'.repeat(40));

  const tableName = 'causation_events';
  await ensureSchema(pool, tableName);
  await pool.query(`DELETE FROM ${tableName}`);

  const repo = new PostgresEventStoreRepository(pool, tableName, false);

  const config: EventStoreConfig = {
    type: 'postgres',
    mode: 'audit',
  };

  const consumer = new EventStorePersistenceConsumer(repo, config);
  let rootCorrelationId: string | undefined;

  // Use valid UUIDs for event IDs (required by the UUID column type)
  const eventId1 = uuidv4();
  const eventId2 = uuidv4();

  // Simulate command → event → handler publishes more events
  await mediatorContext.runWithNewContext(async () => {
    rootCorrelationId = mediatorContext.getCorrelationId();

    // Root event (no causation)
    await consumer.handle(new OrderCreatedEvent('order-chain-1', 'customer-1'));

    // Simulate event handler publishing child events
    await mediatorContext.runWithCausation(eventId1, async () => {
      await consumer.handle(new OrderItemAddedEvent('order-chain-1', 'product-1', 1));

      // Nested handler
      await mediatorContext.runWithCausation(eventId2, async () => {
        await consumer.handle(new OrderPlacedEvent('order-chain-1', 50.0));
      });
    });
  });

  // Verify causation chain
  const result = await pool.query(
    `SELECT event_type, correlation_id, causation_id
     FROM ${tableName} ORDER BY stored_at`
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
  // Root context has no currentEventId, so:
  //   - Event 0 (root): causationId = undefined (no parent)
  //   - Event 1 (inside runWithCausation(eventId1)): causationId = root's currentEventId = undefined
  //     BUT currentEventId = eventId1
  //   - Event 2 (inside runWithCausation(eventId2)): causationId = parent's currentEventId = eventId1
  //     AND currentEventId = eventId2
  assert(result.rows[0].causation_id === null, 'Root event should have no causation');
  assert(result.rows[1].causation_id === null, 'Second event causation should be null (root has no currentEventId)');
  assert(result.rows[2].causation_id === eventId1, 'Third event should have causation eventId1');

  console.log('  ✓ Correlation IDs match across all events');
  console.log('  ✓ Causation chain correctly tracked');
  console.log('✓ Causation Chain tests passed\n');
}

// ============================================
// Utilities
// ============================================

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

// Run tests
runTests().catch(console.error);
