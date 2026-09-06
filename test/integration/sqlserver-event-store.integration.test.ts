import {
  ApplicationIntegrationTest,
  Container,
  RequiredContainer,
} from '@integration-testing/testcontainers';
import type { ConnectionPool } from 'mssql';
import { v4 as uuidv4 } from 'uuid';
import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import type {
  IEventStoreRepository,
  StoredEvent,
} from '../../src/lib/interfaces/event-store.interface.js';
import { sqlServerEventStoreContext } from './sqlserver-event-store.setup.js';

@RequiredContainer([Container.SqlServer])
@ApplicationIntegrationTest
export class SqlServerEventStoreIntegrationTest {}

let pool: ConnectionPool;
let repository: IEventStoreRepository;
let tableName: string;

function storedEvent(overrides: Partial<StoredEvent> = {}): StoredEvent {
  const timestamp = new Date('2026-09-06T09:30:00.000Z');
  return {
    eventId: uuidv4(),
    eventType: 'OrderCreatedEvent',
    payload: { orderId: 'order-1' },
    occurredAt: timestamp,
    storedAt: timestamp,
    correlationId: uuidv4(),
    metadata: { source: 'integration-test' },
    ...overrides,
  };
}

beforeAll(() => {
  ({ pool, repository, tableName } = sqlServerEventStoreContext.current());
});

beforeEach(async () => {
  await pool.request().query(`DELETE FROM ${tableName}`);
});

describe('MssqlEventStoreRepository', () => {
  test('saveEvent persists the supplied event', async () => {
    const event = storedEvent();

    await repository.saveEvent(event);

    const result = await pool.request().query<{
      event_id: string;
      event_type: string;
      payload: string;
      occurred_at: Date;
      stored_at: Date;
    }>(`SELECT * FROM ${tableName} WHERE event_id = '${event.eventId}'`);
    expect(result.recordset).toHaveLength(1);
    const row = result.recordset[0];
    expect(row.event_id.toLowerCase()).toBe(event.eventId);
    expect(row.event_type).toBe(event.eventType);
    expect(JSON.parse(row.payload)).toEqual(event.payload);
    expect(row.occurred_at.getTime()).toBe(event.occurredAt.getTime());
    expect(row.stored_at.getTime()).toBe(event.storedAt.getTime());
  });

  test('appendEvents commits the complete batch', async () => {
    const aggregateId = uuidv4();

    await repository.appendEvents(
      'Order',
      aggregateId,
      [
        storedEvent({ eventType: 'OrderCreatedEvent' }),
        storedEvent({ eventType: 'OrderPlacedEvent' }),
      ],
      0,
    );

    const result = await pool
      .request()
      .input('aggregateType', 'Order')
      .input('aggregateId', aggregateId)
      .query<{ event_type: string; sequence_number: number }>(
        `SELECT event_type, sequence_number
         FROM ${tableName}
         WHERE aggregate_type = @aggregateType AND aggregate_id = @aggregateId
         ORDER BY sequence_number`,
      );

    expect(result.recordset.map(({ event_type }) => event_type)).toEqual([
      'OrderCreatedEvent',
      'OrderPlacedEvent',
    ]);
    expect(
      result.recordset.map(({ sequence_number }) => Number(sequence_number)),
    ).toEqual([1, 2]);
  });

  test('appendEvents rolls back the complete batch when one insert fails', async () => {
    const aggregateId = uuidv4();
    const duplicateEventId = uuidv4();

    await expect(
      repository.appendEvents(
        'Order',
        aggregateId,
        [
          storedEvent({ eventId: duplicateEventId }),
          storedEvent({ eventId: duplicateEventId }),
        ],
        0,
      ),
    ).rejects.toThrow();

    const result = await pool
      .request()
      .input('aggregateType', 'Order')
      .input('aggregateId', aggregateId)
      .query<{ event_count: number }>(
        `SELECT COUNT(*) AS event_count
         FROM ${tableName}
         WHERE aggregate_type = @aggregateType AND aggregate_id = @aggregateId`,
      );
    expect(result.recordset[0].event_count).toBe(0);
  });

  test('getEventsForAggregate returns matching events in sequence order', async () => {
    const aggregateId = uuidv4();
    await repository.appendEvents(
      'Order',
      aggregateId,
      [
        storedEvent({ eventType: 'OrderCreatedEvent' }),
        storedEvent({ eventType: 'OrderPlacedEvent' }),
      ],
      0,
    );

    const events = await repository.getEventsForAggregate('Order', aggregateId);

    expect(events.map(({ eventType }) => eventType)).toEqual([
      'OrderCreatedEvent',
      'OrderPlacedEvent',
    ]);
    expect(events.map(({ sequenceNumber }) => sequenceNumber)).toEqual([1, 2]);
  });

  test('getNextSequence returns the next aggregate sequence', async () => {
    const aggregateId = uuidv4();
    await repository.appendEvents(
      'Order',
      aggregateId,
      [storedEvent(), storedEvent()],
      0,
    );

    await expect(repository.getNextSequence('Order', aggregateId)).resolves.toBe(3);
  });
});
