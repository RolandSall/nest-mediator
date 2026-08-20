/**
 * SQL Server schema for the event store.
 * Uses a filtered unique index for optimistic concurrency in source mode.
 *
 * Events are immutable - once stored, they are never modified or deleted.
 *
 * Differences from the PostgreSQL schema are dialect-forced, not design choices:
 * SQL Server has no `CREATE TABLE IF NOT EXISTS` (hence the `OBJECT_ID` guards),
 * no `JSONB` type (payloads are `NVARCHAR(MAX)` holding JSON text), and spells
 * `UUID`/`TIMESTAMP`/`NOW()` as `UNIQUEIDENTIFIER`/`DATETIME2`/`SYSUTCDATETIME()`.
 *
 * @param tableName - The table name to use (default: 'domain_events')
 * @returns SQL string for creating the schema
 */
export function getSqlServerSchema(tableName: string = 'domain_events'): string {
  return `
    -- Create the events table
    IF OBJECT_ID(N'${tableName}', N'U') IS NULL
    BEGIN
      CREATE TABLE ${tableName} (
        -- Core fields
        event_id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        event_type NVARCHAR(255) NOT NULL,
        payload NVARCHAR(MAX) NOT NULL,
        occurred_at DATETIME2 NOT NULL,
        stored_at DATETIME2 NOT NULL CONSTRAINT DF_${tableName}_stored_at DEFAULT SYSUTCDATETIME(),

        -- Correlation and causation for tracing
        correlation_id UNIQUEIDENTIFIER NULL,
        causation_id UNIQUEIDENTIFIER NULL,
        metadata NVARCHAR(MAX) NULL CONSTRAINT DF_${tableName}_metadata DEFAULT N'{}',

        -- Aggregate tracking (nullable - only populated with @DomainEvent)
        aggregate_type NVARCHAR(255) NULL,
        aggregate_id NVARCHAR(255) NULL,
        sequence_number BIGINT NULL
      );
    END;

    -- Filtered unique index: only enforced when sequence_number IS NOT NULL (source mode).
    -- This allows multiple events with NULL sequence (audit mode) while enforcing
    -- uniqueness for sequenced events (source mode).
    IF NOT EXISTS (SELECT 1 FROM sys.indexes
                   WHERE name = N'idx_${tableName}_unique_aggregate_sequence'
                     AND object_id = OBJECT_ID(N'${tableName}'))
      CREATE UNIQUE INDEX idx_${tableName}_unique_aggregate_sequence
        ON ${tableName} (aggregate_type, aggregate_id, sequence_number)
        WHERE sequence_number IS NOT NULL;

    -- Index for fast aggregate lookups (event sourcing)
    IF NOT EXISTS (SELECT 1 FROM sys.indexes
                   WHERE name = N'idx_${tableName}_aggregate'
                     AND object_id = OBJECT_ID(N'${tableName}'))
      CREATE INDEX idx_${tableName}_aggregate
        ON ${tableName} (aggregate_type, aggregate_id, sequence_number);

    -- Index for event type queries (useful for projections)
    IF NOT EXISTS (SELECT 1 FROM sys.indexes
                   WHERE name = N'idx_${tableName}_type'
                     AND object_id = OBJECT_ID(N'${tableName}'))
      CREATE INDEX idx_${tableName}_type ON ${tableName} (event_type);

    -- Index for correlation tracking (tracing transactions)
    IF NOT EXISTS (SELECT 1 FROM sys.indexes
                   WHERE name = N'idx_${tableName}_correlation'
                     AND object_id = OBJECT_ID(N'${tableName}'))
      CREATE INDEX idx_${tableName}_correlation ON ${tableName} (correlation_id);

    -- Index for causation tracking (tracing event chains)
    IF NOT EXISTS (SELECT 1 FROM sys.indexes
                   WHERE name = N'idx_${tableName}_causation'
                     AND object_id = OBJECT_ID(N'${tableName}'))
      CREATE INDEX idx_${tableName}_causation ON ${tableName} (causation_id);

    -- Index for time-based queries
    IF NOT EXISTS (SELECT 1 FROM sys.indexes
                   WHERE name = N'idx_${tableName}_occurred'
                     AND object_id = OBJECT_ID(N'${tableName}'))
      CREATE INDEX idx_${tableName}_occurred ON ${tableName} (occurred_at);
  `;
}

/**
 * Default schema with default table name
 */
export const SQLSERVER_SCHEMA = getSqlServerSchema('domain_events');
