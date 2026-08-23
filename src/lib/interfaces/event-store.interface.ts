import { Type } from '@nestjs/common';

/**
 * Configuration for the event store.
 *
 * Connection is required (url OR useExistingPool) - the library always
 * creates the schema to guarantee correct table structure.
 *
 * Repository is optional - use built-in or provide custom implementation.
 */
export interface EventStoreConfig {
  /**
   * Database type (required).
   *
   * Selects which dialect implementation is used. The matching driver must be
   * installed: `pg` for 'postgres', `mssql` for 'sqlserver'. Drivers are loaded
   * lazily, so only the one you actually use needs to be present.
   */
  type: 'postgres' | 'sqlserver';

  /**
   * Connection via URL - library creates and manages the pool
   * Must specify either url OR useExistingPool (not both)
   * Example (postgres):  'postgres://user:pass@localhost:5432/mydb'
   * Example (sqlserver): 'Server=localhost,1433;Database=mydb;User Id=sa;Password=pass;Encrypt=false'
   */
  url?: string;

  /**
   * Connection via existing pool - provide the injection token
   * Must specify either url OR useExistingPool (not both)
   * Example: 'PG_POOL' or 'DATABASE_POOL'
   */
  useExistingPool?: string;

  /**
   * Option 3a: Custom repository class (library instantiates it)
   * If not provided, uses built-in PostgresEventStoreRepository
   * Custom class must implement IEventStoreRepository
   * Constructor receives (pool, tableName) arguments
   * Requires: url OR useExistingPool
   */
  repository?: Type<IEventStoreRepository>;

  /**
   * Option 3b: Existing repository via DI (user provides and registers it)
   * The injection token for user's pre-registered repository
   * Library will alias EVENT_STORE_REPOSITORY to this token
   * Requires: url (for schema creation only, pool is closed after)
   */
  useExistingRepository?: string;

  /**
   * Storage mode
   * - 'audit': Simple event logging, no sequence tracking
   * - 'source': Full event sourcing with sequence and concurrency control
   * Default: 'audit'
   */
  mode?: 'audit' | 'source';

  /**
   * Custom table name
   * Default: 'domain_events'
   */
  tableName?: string;
}

/**
 * Represents a stored event in the database.
 * Events are immutable facts - once stored, they are never modified or deleted.
 */
export interface StoredEvent {
  /**
   * Unique identifier for the event
   */
  eventId: string;

  /**
   * The event class name (e.g., 'OrderPlacedEvent')
   */
  eventType: string;

  /**
   * The serialized event data
   */
  payload: Record<string, unknown>;

  /**
   * When the event occurred (business time), represented as an absolute instant.
   * New built-in event-store tables persist this with timezone-aware columns.
   */
  occurredAt: Date;

  /**
   * When the event was stored (system time), represented as an absolute instant.
   * New built-in event-store tables persist this with timezone-aware columns.
   */
  storedAt: Date;

  /**
   * Groups related events in the same business transaction
   */
  correlationId?: string;

  /**
   * Points to the direct cause of this event
   */
  causationId?: string;

  /**
   * Additional metadata
   */
  metadata?: Record<string, unknown>;

  /**
   * The aggregate type (if decorated with @DomainEvent)
   */
  aggregateType?: string;

  /**
   * The aggregate ID (if decorated with @DomainEvent)
   */
  aggregateId?: string;

  /**
   * Sequence number within the aggregate (source mode only)
   */
  sequenceNumber?: number;
}

/**
 * Repository interface for event storage operations.
 * Events are immutable - this interface only supports appending, not modifying.
 */
export interface IEventStoreRepository {
  /**
   * Save a single event (used in audit mode or source mode without aggregate)
   *
   * @param event - The event to save
   */
  saveEvent(event: StoredEvent): Promise<void>;

  /**
   * Append events with sequence tracking and concurrency control (source mode)
   *
   * @param aggregateType - The aggregate type
   * @param aggregateId - The aggregate ID
   * @param events - The events to append
   * @param expectedVersion - The expected current version (for optimistic locking)
   * @throws ConcurrencyError if expectedVersion doesn't match current version
   */
  appendEvents(
    aggregateType: string,
    aggregateId: string,
    events: StoredEvent[],
    expectedVersion: number
  ): Promise<void>;

  /**
   * Get all events for an aggregate, ordered by sequence number
   *
   * @param aggregateType - The aggregate type
   * @param aggregateId - The aggregate ID
   * @returns Array of stored events
   */
  getEventsForAggregate(
    aggregateType: string,
    aggregateId: string
  ): Promise<StoredEvent[]>;

  /**
   * Get the next sequence number for an aggregate
   *
   * @param aggregateType - The aggregate type
   * @param aggregateId - The aggregate ID
   * @returns The next sequence number
   */
  getNextSequence(aggregateType: string, aggregateId: string): Promise<number>;
}

/**
 * Error thrown when optimistic concurrency check fails
 */
export class ConcurrencyError extends Error {
  constructor(
    public readonly aggregateType: string,
    public readonly aggregateId: string,
    public readonly expectedVersion: number,
    public readonly actualVersion: number
  ) {
    super(
      `Concurrency conflict: ${aggregateType}[${aggregateId}] ` +
        `expected version ${expectedVersion} but found ${actualVersion}`
    );
    this.name = 'ConcurrencyError';
  }
}

/**
 * Injection token for the event store repository
 */
export const EVENT_STORE_REPOSITORY = 'EVENT_STORE_REPOSITORY';
