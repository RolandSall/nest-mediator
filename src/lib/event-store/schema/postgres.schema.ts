/**
 * PostgreSQL schema for the event store.
 * Uses a partial unique index for optimistic concurrency in source mode.
 *
 * Events are immutable - once stored, they are never modified or deleted.
 *
 * @param tableName - The table name to use (default: 'domain_events')
 * @returns SQL string for creating the schema
 */
export function getPostgresSchema(tableName: string = 'domain_events'): string {
  return `
    -- Create the events table
    CREATE TABLE IF NOT EXISTS ${tableName} (
      -- Core fields
      event_id UUID PRIMARY KEY,
      event_type VARCHAR(255) NOT NULL,
      payload JSONB NOT NULL,
      occurred_at TIMESTAMPTZ NOT NULL,
      stored_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      -- Correlation and causation for tracing
      correlation_id UUID,
      causation_id UUID,
      metadata JSONB DEFAULT '{}',

      -- Aggregate tracking (nullable - only populated with @DomainEvent)
      aggregate_type VARCHAR(255),
      aggregate_id VARCHAR(255),
      sequence_number BIGINT
    );

    -- Partial unique index: only enforced when sequence_number IS NOT NULL (source mode)
    -- This allows multiple events with NULL sequence (audit mode) while enforcing
    -- uniqueness for sequenced events (source mode)
    CREATE UNIQUE INDEX IF NOT EXISTS idx_${tableName}_unique_aggregate_sequence
      ON ${tableName} (aggregate_type, aggregate_id, sequence_number)
      WHERE sequence_number IS NOT NULL;

    -- Index for fast aggregate lookups (event sourcing)
    CREATE INDEX IF NOT EXISTS idx_${tableName}_aggregate
      ON ${tableName} (aggregate_type, aggregate_id, sequence_number);

    -- Index for event type queries (useful for projections)
    CREATE INDEX IF NOT EXISTS idx_${tableName}_type
      ON ${tableName} (event_type);

    -- Index for correlation tracking (tracing transactions)
    CREATE INDEX IF NOT EXISTS idx_${tableName}_correlation
      ON ${tableName} (correlation_id);

    -- Index for causation tracking (tracing event chains)
    CREATE INDEX IF NOT EXISTS idx_${tableName}_causation
      ON ${tableName} (causation_id);

    -- Index for time-based queries
    CREATE INDEX IF NOT EXISTS idx_${tableName}_occurred
      ON ${tableName} (occurred_at);
  `;
}

/**
 * Default schema with default table name
 */
export const POSTGRES_SCHEMA = getPostgresSchema('domain_events');
