-- MediatorFlow Schema

CREATE TABLE IF NOT EXISTS services (
  service_name   TEXT NOT NULL,
  instance_id    TEXT NOT NULL,
  booted_at      TIMESTAMPTZ NOT NULL,
  library_version TEXT NOT NULL,
  last_seen_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (service_name, instance_id)
);

CREATE TABLE IF NOT EXISTS topology_commands (
  id             SERIAL PRIMARY KEY,
  service_name   TEXT NOT NULL,
  command_name   TEXT NOT NULL,
  handler_name   TEXT NOT NULL,
  UNIQUE (service_name, command_name)
);

CREATE TABLE IF NOT EXISTS topology_queries (
  id             SERIAL PRIMARY KEY,
  service_name   TEXT NOT NULL,
  query_name     TEXT NOT NULL,
  handler_name   TEXT NOT NULL,
  UNIQUE (service_name, query_name)
);

CREATE TABLE IF NOT EXISTS topology_events (
  id             SERIAL PRIMARY KEY,
  service_name   TEXT NOT NULL,
  event_name     TEXT NOT NULL,
  aggregate_type TEXT,
  UNIQUE (service_name, event_name)
);

CREATE TABLE IF NOT EXISTS topology_consumers (
  id                SERIAL PRIMARY KEY,
  topology_event_id INTEGER NOT NULL REFERENCES topology_events(id) ON DELETE CASCADE,
  consumer_name     TEXT NOT NULL,
  criticality       TEXT NOT NULL DEFAULT 'non-critical',
  consumer_order    INTEGER NOT NULL DEFAULT 0,
  has_compensation  BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (topology_event_id, consumer_name)
);

CREATE TABLE IF NOT EXISTS topology_behaviors (
  id                SERIAL PRIMARY KEY,
  service_name      TEXT NOT NULL,
  behavior_name     TEXT NOT NULL,
  priority          INTEGER NOT NULL DEFAULT 0,
  scope             TEXT NOT NULL DEFAULT 'all',
  request_type_name TEXT,
  UNIQUE (service_name, behavior_name)
);

CREATE TABLE IF NOT EXISTS topology_aggregates (
  id               SERIAL PRIMARY KEY,
  service_name     TEXT NOT NULL,
  aggregate_type   TEXT NOT NULL,
  repository_name  TEXT NOT NULL,
  event_types      TEXT[] NOT NULL DEFAULT '{}',
  UNIQUE (service_name, aggregate_type)
);

CREATE TABLE IF NOT EXISTS execution_steps (
  step_id         TEXT PRIMARY KEY,
  instance_id     TEXT NOT NULL,
  service_name    TEXT NOT NULL,
  step_type       TEXT NOT NULL,
  timestamp       TIMESTAMPTZ NOT NULL,
  correlation_id  TEXT NOT NULL,
  causation_id    TEXT,
  event_id        TEXT,
  duration_ms     DOUBLE PRECISION,
  name            TEXT NOT NULL,
  error           TEXT,
  payload         JSONB,
  metadata        JSONB
);

CREATE INDEX IF NOT EXISTS idx_steps_correlation ON execution_steps (correlation_id);
CREATE INDEX IF NOT EXISTS idx_steps_corr_ts ON execution_steps (correlation_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_steps_service_ts ON execution_steps (service_name, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_steps_type ON execution_steps (step_type);
CREATE INDEX IF NOT EXISTS idx_steps_name ON execution_steps (name);
CREATE INDEX IF NOT EXISTS idx_steps_event ON execution_steps (event_id);
CREATE INDEX IF NOT EXISTS idx_steps_errors ON execution_steps (correlation_id) WHERE error IS NOT NULL;

-- Materialized view for trace summaries
CREATE MATERIALIZED VIEW IF NOT EXISTS traces AS
SELECT
  correlation_id,
  MIN(timestamp) AS started_at,
  EXTRACT(EPOCH FROM (MAX(timestamp) - MIN(timestamp))) * 1000 AS duration_ms,
  COUNT(*) AS step_count,
  COUNT(*) FILTER (WHERE error IS NOT NULL) AS error_count,
  COUNT(*) FILTER (WHERE step_type LIKE 'COMPENSATION_%') AS compensation_count,
  (array_agg(name ORDER BY CASE step_type WHEN 'COMMAND_DISPATCHED' THEN 0 WHEN 'QUERY_DISPATCHED' THEN 0 ELSE 1 END, timestamp))[1] AS entry_name,
  (array_agg(service_name ORDER BY timestamp))[1] AS service_name,
  COUNT(*) FILTER (WHERE error IS NOT NULL) > 0 AS has_errors,
  COUNT(*) FILTER (WHERE step_type LIKE 'COMPENSATION_%') > 0 AS has_compensations
FROM execution_steps
GROUP BY correlation_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_traces_corr ON traces (correlation_id);
CREATE INDEX IF NOT EXISTS idx_traces_started ON traces (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_traces_errors ON traces (has_errors) WHERE has_errors = TRUE;
CREATE INDEX IF NOT EXISTS idx_traces_comp ON traces (has_compensations) WHERE has_compensations = TRUE;
CREATE INDEX IF NOT EXISTS idx_traces_service ON traces (service_name);
