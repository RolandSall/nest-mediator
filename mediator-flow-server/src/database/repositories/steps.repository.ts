import { Injectable, Inject, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../constants';

interface StepRow {
  step_id: string;
  instance_id: string;
  service_name: string;
  step_type: string;
  timestamp: string;
  correlation_id: string;
  causation_id?: string;
  event_id?: string;
  duration_ms?: number;
  name: string;
  error?: string;
  payload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class StepsRepository {
  private readonly logger = new Logger('StepsRepository');
  private refreshPending = false;

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async bulkInsert(serviceName: string, steps: StepRow[]) {
    if (steps.length === 0) return;

    const values: any[] = [];
    const placeholders: string[] = [];

    steps.forEach((s, i) => {
      const offset = i * 13;
      placeholders.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12}, $${offset + 13})`,
      );
      values.push(
        s.step_id,
        s.instance_id,
        serviceName,
        s.step_type,
        s.timestamp,
        s.correlation_id,
        s.causation_id ?? null,
        s.event_id ?? null,
        s.duration_ms ?? null,
        s.name,
        s.error ?? null,
        s.payload ? JSON.stringify(s.payload) : null,
        s.metadata ? JSON.stringify(s.metadata) : null,
      );
    });

    await this.pool.query(
      `INSERT INTO execution_steps (step_id, instance_id, service_name, step_type, timestamp, correlation_id, causation_id, event_id, duration_ms, name, error, payload, metadata)
       VALUES ${placeholders.join(', ')}
       ON CONFLICT (step_id) DO NOTHING`,
      values,
    );

    // Debounced materialized view refresh
    this.scheduleRefresh();
  }

  private scheduleRefresh() {
    if (this.refreshPending) return;
    this.refreshPending = true;
    setTimeout(async () => {
      try {
        await this.pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY traces');
      } catch (err) {
        this.logger.warn(`Refresh traces view: ${(err as Error).message}`);
      } finally {
        this.refreshPending = false;
      }
    }, 2000);
  }

  async getStepsByCorrelation(correlationId: string) {
    const result = await this.pool.query(
      `SELECT * FROM execution_steps WHERE correlation_id = $1 ORDER BY timestamp ASC`,
      [correlationId],
    );
    return result.rows;
  }

  async getAggregateEvents(aggregateType: string, aggregateId: string) {
    const result = await this.pool.query(
      `SELECT * FROM execution_steps
       WHERE step_type = 'EVENT_PUBLISHED'
         AND metadata->>'aggregateType' = $1
         AND metadata->>'aggregateId' = $2
       ORDER BY timestamp ASC`,
      [aggregateType, aggregateId],
    );
    return result.rows;
  }

  async getStats(serviceName?: string, since?: string) {
    const conditions: string[] = [];
    const params: any[] = [];

    if (serviceName) {
      params.push(serviceName);
      conditions.push(`service_name = $${params.length}`);
    }
    if (since) {
      params.push(since);
      conditions.push(`timestamp >= $${params.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await this.pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE step_type = 'COMMAND_DISPATCHED') AS command_count,
         COUNT(*) FILTER (WHERE step_type = 'QUERY_DISPATCHED') AS query_count,
         COUNT(*) FILTER (WHERE error IS NOT NULL) AS error_count,
         COUNT(*) FILTER (WHERE step_type LIKE 'COMPENSATION_%') AS compensation_count,
         COUNT(*) AS total_steps,
         MIN(timestamp) AS first_step,
         MAX(timestamp) AS last_step
       FROM execution_steps ${where}`,
      params,
    );

    const stats = result.rows[0];
    const durationMinutes = stats.first_step && stats.last_step
      ? (new Date(stats.last_step).getTime() - new Date(stats.first_step).getTime()) / 60000
      : 1;

    // Top errors
    const topErrors = await this.pool.query(
      `SELECT name, error, COUNT(*) as count
       FROM execution_steps
       ${where ? where + ' AND' : 'WHERE'} error IS NOT NULL
       GROUP BY name, error ORDER BY count DESC LIMIT 10`,
      params,
    );

    // Top slow
    const topSlow = await this.pool.query(
      `SELECT name, step_type, duration_ms
       FROM execution_steps
       ${where ? where + ' AND' : 'WHERE'} duration_ms IS NOT NULL
       ORDER BY duration_ms DESC LIMIT 10`,
      params,
    );

    return {
      commandsPerMin: Math.round((Number(stats.command_count) / Math.max(durationMinutes, 1)) * 100) / 100,
      queriesPerMin: Math.round((Number(stats.query_count) / Math.max(durationMinutes, 1)) * 100) / 100,
      errorRate: stats.total_steps > 0
        ? Math.round((Number(stats.error_count) / Number(stats.total_steps)) * 10000) / 100
        : 0,
      compensationCount: Number(stats.compensation_count),
      totalSteps: Number(stats.total_steps),
      topErrors: topErrors.rows,
      topSlow: topSlow.rows,
    };
  }

  async search(query: string, type?: string) {
    const conditions: string[] = [`(name ILIKE $1 OR error ILIKE $1)`];
    const params: any[] = [`%${query}%`];

    if (type) {
      params.push(type);
      conditions.push(`step_type = $${params.length}`);
    }

    const result = await this.pool.query(
      `SELECT * FROM execution_steps WHERE ${conditions.join(' AND ')} ORDER BY timestamp DESC LIMIT 100`,
      params,
    );
    return result.rows;
  }

  async deleteOlderThan(days: number) {
    const result = await this.pool.query(
      `DELETE FROM execution_steps WHERE timestamp < NOW() - INTERVAL '1 day' * $1`,
      [days],
    );
    return result.rowCount ?? 0;
  }
}
