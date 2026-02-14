import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../constants';

@Injectable()
export class TracesRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async getTraces(options: {
    page?: number;
    limit?: number;
    hasErrors?: boolean;
    hasCompensations?: boolean;
    service?: string;
    since?: string;
    search?: string;
  }) {
    const page = options.page ?? 1;
    const limit = Math.min(options.limit ?? 50, 200);
    const offset = (page - 1) * limit;
    const conditions: string[] = [];
    const params: any[] = [];

    if (options.hasErrors !== undefined) {
      params.push(options.hasErrors);
      conditions.push(`has_errors = $${params.length}`);
    }
    if (options.hasCompensations !== undefined) {
      params.push(options.hasCompensations);
      conditions.push(`has_compensations = $${params.length}`);
    }
    if (options.service) {
      params.push(options.service);
      conditions.push(`service_name = $${params.length}`);
    }
    if (options.since) {
      params.push(options.since);
      conditions.push(`started_at >= $${params.length}`);
    }
    if (options.search) {
      params.push(`%${options.search}%`);
      conditions.push(`(entry_name ILIKE $${params.length} OR correlation_id ILIKE $${params.length})`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [data, countResult] = await Promise.all([
      this.pool.query(
        `SELECT * FROM traces ${where} ORDER BY started_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset],
      ),
      this.pool.query(
        `SELECT COUNT(*) as total FROM traces ${where}`,
        params,
      ),
    ]);

    return {
      traces: data.rows.map((r: any) => ({
        correlationId: r.correlation_id,
        startedAt: r.started_at,
        durationMs: Number(r.duration_ms),
        stepCount: Number(r.step_count),
        errorCount: Number(r.error_count),
        compensationCount: Number(r.compensation_count),
        entryName: r.entry_name,
        serviceName: r.service_name,
        hasErrors: r.has_errors,
        hasCompensations: r.has_compensations,
      })),
      total: Number(countResult.rows[0].total),
      page,
      limit,
    };
  }
}
