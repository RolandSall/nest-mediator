import {
  ApplicationIntegrationTest,
  Container,
  RequiredContainer,
} from '@integration-testing/testcontainers';
import type { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { PostgresEventStoreRepository } from '../../src/lib/event-store/repositories/postgres-event-store.repository.js';
import { getPostgresSchema } from '../../src/lib/event-store/schema/postgres.schema.js';
import type { StoredEvent } from '../../src/lib/interfaces/event-store.interface.js';
import { postgresEventStoreContext } from './postgres-event-store.setup.js';

@RequiredContainer([Container.PostgreSql])
@ApplicationIntegrationTest
export class PostgreSqlEventStoreIntegrationTest {}

const tableName = 'postgres_repository_events';

let pool: Pool;
let repository: PostgresEventStoreRepository;

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

beforeAll(async () => {
  pool = postgresEventStoreContext.current();
  await pool.query(getPostgresSchema(tableName));
  repository = new PostgresEventStoreRepository(pool, tableName);
});

beforeEach(async () => {
  await pool.query(`TRUNCATE TABLE ${tableName}`);
});

describe('PostgresEventStoreRepository', () => {
  test('saveEvent persists the supplied event', async () => {
    const event = storedEvent();

    await repository.saveEvent(event);

    const result = await pool.query<{
      event_id: string;
      event_type: string;
      payload: Record<string, unknown>;
      occurred_at: Date;
      stored_at: Date;
    }>(`SELECT * FROM ${tableName} WHERE event_id = $1`, [event.eventId]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      event_id: event.eventId,
      event_type: event.eventType,
      payload: event.payload,
    });
    expect(result.rows[0].occurred_at.getTime()).toBe(event.occurredAt.getTime());
    expect(result.rows[0].stored_at.getTime()).toBe(event.storedAt.getTime());
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

    const result = await pool.query<{
      event_type: string;
      sequence_number: string;
    }>(
      `SELECT event_type, sequence_number
       FROM ${tableName}
       WHERE aggregate_type = $1 AND aggregate_id = $2
       ORDER BY sequence_number`,
      ['Order', aggregateId],
    );

    expect(result.rows.map(({ event_type }) => event_type)).toEqual([
      'OrderCreatedEvent',
      'OrderPlacedEvent',
    ]);
    expect(
      result.rows.map(({ sequence_number }) => Number(sequence_number)),
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

    const result = await pool.query<{ event_count: string }>(
      `SELECT COUNT(*) AS event_count
       FROM ${tableName}
       WHERE aggregate_type = $1 AND aggregate_id = $2`,
      ['Order', aggregateId],
    );
    expect(Number(result.rows[0].event_count)).toBe(0);
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
