import { OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import {
  IEventStoreRepository,
  StoredEvent,
  ConcurrencyError,
} from '../../interfaces/event-store.interface.js';

/**
 * PostgreSQL implementation of the event store repository.
 * Events are immutable - this repository only supports appending, not modifying.
 */
export class PostgresEventStoreRepository
  implements IEventStoreRepository, OnModuleDestroy
{
  /**
   * Create a new PostgreSQL event store repository.
   *
   * @param pool - The database connection pool
   * @param tableName - The table name to use (default: 'domain_events')
   * @param ownsPool - Whether this repository owns the pool and should close it on destroy
   *                   - true: Library created the pool (Option 1) → close on shutdown
   *                   - false: User provided the pool (Option 2) → don't close
   */
  constructor(
    private readonly pool: Pool,
    private readonly tableName: string = 'domain_events',
    private readonly ownsPool: boolean = false
  ) {}

  /**
   * Clean up resources when the module is destroyed.
   * Only closes the pool if we created it (ownsPool = true).
   */
  async onModuleDestroy(): Promise<void> {
    if (this.ownsPool) {
      await this.pool.end();
    }
  }

  /**
   * Save a single event (audit mode or source mode without aggregate).
   */
  async saveEvent(event: StoredEvent): Promise<void> {
    await this.pool.query(
      `INSERT INTO ${this.tableName} (
        event_id, event_type, payload, occurred_at, stored_at,
        correlation_id, causation_id, metadata,
        aggregate_type, aggregate_id, sequence_number
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        event.eventId,
        event.eventType,
        JSON.stringify(event.payload),
        event.occurredAt,
        event.storedAt,
        event.correlationId ?? null,
        event.causationId ?? null,
        JSON.stringify(event.metadata ?? {}),
        event.aggregateType ?? null,
        event.aggregateId ?? null,
        event.sequenceNumber ?? null,
      ]
    );
  }

  /**
   * Append events with sequence tracking and optimistic concurrency control.
   * Used in source mode for event sourcing.
   */
  async appendEvents(
    aggregateType: string,
    aggregateId: string,
    events: StoredEvent[],
    expectedVersion: number
  ): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Check current version (optimistic locking)
      const versionResult = await client.query(
        `SELECT COALESCE(MAX(sequence_number), 0) as current_version
         FROM ${this.tableName}
         WHERE aggregate_type = $1 AND aggregate_id = $2`,
        [aggregateType, aggregateId]
      );

      const currentVersion = parseInt(versionResult.rows[0].current_version, 10);

      if (currentVersion !== expectedVersion) {
        throw new ConcurrencyError(
          aggregateType,
          aggregateId,
          expectedVersion,
          currentVersion
        );
      }

      // Insert events with incrementing sequence
      let sequence = currentVersion;
      for (const event of events) {
        sequence++;

        await client.query(
          `INSERT INTO ${this.tableName} (
            event_id, event_type, payload, occurred_at, stored_at,
            correlation_id, causation_id, metadata,
            aggregate_type, aggregate_id, sequence_number
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            event.eventId,
            event.eventType,
            JSON.stringify(event.payload),
            event.occurredAt,
            event.storedAt,
            event.correlationId ?? null,
            event.causationId ?? null,
            JSON.stringify(event.metadata ?? {}),
            aggregateType,
            aggregateId,
            sequence,
          ]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get all events for an aggregate, ordered by sequence.
   */
  async getEventsForAggregate(
    aggregateType: string,
    aggregateId: string
  ): Promise<StoredEvent[]> {
    const result = await this.pool.query(
      `SELECT * FROM ${this.tableName}
       WHERE aggregate_type = $1
         AND aggregate_id = $2
         AND sequence_number IS NOT NULL
       ORDER BY sequence_number ASC`,
      [aggregateType, aggregateId]
    );

    return result.rows.map(this.mapRowToStoredEvent);
  }

  /**
   * Get the next sequence number for an aggregate.
   */
  async getNextSequence(
    aggregateType: string,
    aggregateId: string
  ): Promise<number> {
    const result = await this.pool.query(
      `SELECT COALESCE(MAX(sequence_number), 0) + 1 as next_seq
       FROM ${this.tableName}
       WHERE aggregate_type = $1 AND aggregate_id = $2`,
      [aggregateType, aggregateId]
    );
    return parseInt(result.rows[0].next_seq, 10);
  }

  /**
   * Map a database row to a StoredEvent object.
   */
  private mapRowToStoredEvent(row: Record<string, unknown>): StoredEvent {
    return {
      eventId: row.event_id as string,
      eventType: row.event_type as string,
      payload: row.payload as Record<string, unknown>,
      occurredAt: row.occurred_at as Date,
      storedAt: row.stored_at as Date,
      correlationId: row.correlation_id as string | undefined,
      causationId: row.causation_id as string | undefined,
      metadata: row.metadata as Record<string, unknown> | undefined,
      aggregateType: row.aggregate_type as string | undefined,
      aggregateId: row.aggregate_id as string | undefined,
      sequenceNumber: row.sequence_number
        ? parseInt(row.sequence_number as string, 10)
        : undefined,
    };
  }
}
