import { OnModuleDestroy } from '@nestjs/common';
import type { ConnectionPool, IRecordSet } from 'mssql';
import type * as mssql from 'mssql';
import {
  IEventStoreRepository,
  StoredEvent,
  ConcurrencyError,
} from '../../interfaces/event-store.interface.js';

/** SQL Server error numbers for a unique-index violation. */
const DUPLICATE_KEY_ERRORS = [2601, 2627];

/**
 * SQL Server implementation of the event store repository.
 * Events are immutable - this repository only supports appending, not modifying.
 *
 * Mirrors {@link PostgresEventStoreRepository} exactly in behaviour; the differences
 * are dialect mechanics (named `@parameters`, `NVARCHAR(MAX)` JSON text, explicit
 * `Transaction` objects, and locking hints for the concurrency check).
 */
export class MssqlEventStoreRepository
  implements IEventStoreRepository, OnModuleDestroy
{
  /**
   * Create a new SQL Server event store repository.
   *
   * @param pool - The database connection pool
   * @param sql - The loaded `mssql` module, used for parameter type constants
   * @param tableName - The table name to use (default: 'domain_events')
   * @param ownsPool - Whether this repository owns the pool and should close it on destroy
   */
  constructor(
    private readonly pool: ConnectionPool,
    private readonly sql: typeof mssql,
    private readonly tableName: string = 'domain_events',
    private readonly ownsPool: boolean = false
  ) {}

  /**
   * Clean up resources when the module is destroyed.
   * Only closes the pool if we created it (ownsPool = true).
   */
  async onModuleDestroy(): Promise<void> {
    if (this.ownsPool) {
      await this.pool.close();
    }
  }

  /**
   * Bind one event's columns onto a request. Types are declared explicitly because
   * SQL Server cannot infer a type for a NULL value, and most columns here are nullable.
   */
  private bindEvent(
    request: mssql.Request,
    event: StoredEvent,
    aggregateType: string | null,
    aggregateId: string | null,
    sequenceNumber: number | null
  ): mssql.Request {
    const s = this.sql;
    return request
      .input('event_id', s.UniqueIdentifier, event.eventId)
      .input('event_type', s.NVarChar(255), event.eventType)
      .input('payload', s.NVarChar(s.MAX), JSON.stringify(event.payload))
      // Bind UTC clock fields as DATETIME2. New DATETIMEOFFSET columns assign
      // the omitted offset as +00:00, while legacy DATETIME2 columns keep the
      // exact pre-upgrade parameter contract.
      .input('occurred_at', s.DateTime2(7), event.occurredAt)
      .input('stored_at', s.DateTime2(7), event.storedAt)
      .input('correlation_id', s.UniqueIdentifier, event.correlationId ?? null)
      .input('causation_id', s.UniqueIdentifier, event.causationId ?? null)
      .input('metadata', s.NVarChar(s.MAX), JSON.stringify(event.metadata ?? {}))
      .input('aggregate_type', s.NVarChar(255), aggregateType)
      .input('aggregate_id', s.NVarChar(255), aggregateId)
      .input('sequence_number', s.BigInt, sequenceNumber);
  }

  private get insertSql(): string {
    return `INSERT INTO ${this.tableName} (
        event_id, event_type, payload, occurred_at, stored_at,
        correlation_id, causation_id, metadata,
        aggregate_type, aggregate_id, sequence_number
      ) VALUES (
        @event_id, @event_type, @payload, @occurred_at, @stored_at,
        @correlation_id, @causation_id, @metadata,
        @aggregate_type, @aggregate_id, @sequence_number
      )`;
  }

  /**
   * Save a single event (audit mode or source mode without aggregate).
   */
  async saveEvent(event: StoredEvent): Promise<void> {
    const request = this.bindEvent(
      this.pool.request(),
      event,
      event.aggregateType ?? null,
      event.aggregateId ?? null,
      event.sequenceNumber ?? null
    );
    await request.query(this.insertSql);
  }

  /**
   * Append events with sequence tracking and optimistic concurrency control.
   * Used in source mode for event sourcing.
   *
   * The version check takes UPDLOCK/HOLDLOCK so a concurrent writer blocks rather than
   * reading the same MAX and racing us to the same sequence number. Without the hints,
   * SQL Server's default READ COMMITTED releases the shared lock immediately and both
   * writers would pick the same sequence, surfacing a raw driver error rather than a
   * ConcurrencyError. The duplicate-key mapping below is the backstop.
   */
  async appendEvents(
    aggregateType: string,
    aggregateId: string,
    events: StoredEvent[],
    expectedVersion: number
  ): Promise<void> {
    const transaction = this.pool.transaction();
    await transaction.begin();

    try {
      // Check current version (optimistic locking)
      const versionResult = await transaction
        .request()
        .input('aggregate_type', this.sql.NVarChar(255), aggregateType)
        .input('aggregate_id', this.sql.NVarChar(255), aggregateId)
        .query(
          `SELECT COALESCE(MAX(sequence_number), 0) AS current_version
           FROM ${this.tableName} WITH (UPDLOCK, HOLDLOCK)
           WHERE aggregate_type = @aggregate_type AND aggregate_id = @aggregate_id`
        );

      const currentVersion = Number(versionResult.recordset[0].current_version);

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
        const request = this.bindEvent(
          transaction.request(),
          event,
          aggregateType,
          aggregateId,
          sequence
        );
        await request.query(this.insertSql);
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw this.toConcurrencyError(error, aggregateType, aggregateId, expectedVersion);
    }
  }

  /**
   * Translate a duplicate-key violation on the sequence index into a ConcurrencyError,
   * so callers see the same failure type they would on PostgreSQL. Anything else is
   * rethrown untouched.
   */
  private toConcurrencyError(
    error: unknown,
    aggregateType: string,
    aggregateId: string,
    expectedVersion: number
  ): unknown {
    if (error instanceof ConcurrencyError) {
      return error;
    }
    const number = (error as { number?: number })?.number;
    if (number !== undefined && DUPLICATE_KEY_ERRORS.includes(number)) {
      return new ConcurrencyError(
        aggregateType,
        aggregateId,
        expectedVersion,
        // A racing writer already took this slot; the actual version is at least ours.
        expectedVersion + 1
      );
    }
    return error;
  }

  /**
   * Get all events for an aggregate, ordered by sequence.
   */
  async getEventsForAggregate(
    aggregateType: string,
    aggregateId: string
  ): Promise<StoredEvent[]> {
    const result = await this.pool
      .request()
      .input('aggregate_type', this.sql.NVarChar(255), aggregateType)
      .input('aggregate_id', this.sql.NVarChar(255), aggregateId)
      .query(
        `SELECT * FROM ${this.tableName}
         WHERE aggregate_type = @aggregate_type
           AND aggregate_id = @aggregate_id
           AND sequence_number IS NOT NULL
         ORDER BY sequence_number ASC`
      );

    return (result.recordset as IRecordSet<Record<string, unknown>>).map((row) =>
      this.mapRowToStoredEvent(row)
    );
  }

  /**
   * Get the next sequence number for an aggregate.
   */
  async getNextSequence(
    aggregateType: string,
    aggregateId: string
  ): Promise<number> {
    const result = await this.pool
      .request()
      .input('aggregate_type', this.sql.NVarChar(255), aggregateType)
      .input('aggregate_id', this.sql.NVarChar(255), aggregateId)
      .query(
        `SELECT COALESCE(MAX(sequence_number), 0) + 1 AS next_seq
         FROM ${this.tableName}
         WHERE aggregate_type = @aggregate_type AND aggregate_id = @aggregate_id`
      );
    return Number(result.recordset[0].next_seq);
  }

  /**
   * Map a database row to a StoredEvent object.
   *
   * Two dialect fixups relative to PostgreSQL: JSON columns arrive as text and must be
   * parsed, and UNIQUEIDENTIFIER values arrive upper-cased, so they are normalised to
   * lower case to match what PostgreSQL returns.
   */
  private mapRowToStoredEvent(row: Record<string, unknown>): StoredEvent {
    return {
      eventId: this.normalizeGuid(row.event_id) as string,
      eventType: row.event_type as string,
      payload: this.parseJson(row.payload) ?? {},
      occurredAt: row.occurred_at as Date,
      storedAt: row.stored_at as Date,
      correlationId: this.normalizeGuid(row.correlation_id),
      causationId: this.normalizeGuid(row.causation_id),
      metadata: this.parseJson(row.metadata),
      aggregateType: (row.aggregate_type as string) ?? undefined,
      aggregateId: (row.aggregate_id as string) ?? undefined,
      sequenceNumber:
        row.sequence_number !== null && row.sequence_number !== undefined
          ? Number(row.sequence_number)
          : undefined,
    };
  }

  private normalizeGuid(value: unknown): string | undefined {
    return typeof value === 'string' ? value.toLowerCase() : undefined;
  }

  private parseJson(value: unknown): Record<string, unknown> | undefined {
    if (value === null || value === undefined) return undefined;
    if (typeof value === 'object') return value as Record<string, unknown>;
    try {
      return JSON.parse(value as string) as Record<string, unknown>;
    } catch {
      return undefined;
    }
  }
}
