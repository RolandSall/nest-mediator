import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../constants';

export interface DiagramRow {
  id: string;
  name: string;
  description: string | null;
  graph: { nodes: any[]; edges: any[] };
  created_at: string;
  updated_at: string;
}

@Injectable()
export class DiagramsRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async findAll(): Promise<DiagramRow[]> {
    const result = await this.pool.query(
      `SELECT id, name, description, graph, created_at, updated_at
       FROM diagrams ORDER BY updated_at DESC`,
    );
    return result.rows;
  }

  async findById(id: string): Promise<DiagramRow | null> {
    const result = await this.pool.query(
      `SELECT id, name, description, graph, created_at, updated_at
       FROM diagrams WHERE id = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  async create(data: {
    name: string;
    description?: string;
    graph: { nodes: any[]; edges: any[] };
  }): Promise<DiagramRow> {
    const result = await this.pool.query(
      `INSERT INTO diagrams (name, description, graph)
       VALUES ($1, $2, $3)
       RETURNING id, name, description, graph, created_at, updated_at`,
      [data.name, data.description ?? null, JSON.stringify(data.graph)],
    );
    return result.rows[0];
  }

  async update(
    id: string,
    data: { name?: string; description?: string; graph?: { nodes: any[]; edges: any[] } },
  ): Promise<DiagramRow | null> {
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (data.name !== undefined) {
      sets.push(`name = $${idx++}`);
      params.push(data.name);
    }
    if (data.description !== undefined) {
      sets.push(`description = $${idx++}`);
      params.push(data.description);
    }
    if (data.graph !== undefined) {
      sets.push(`graph = $${idx++}`);
      params.push(JSON.stringify(data.graph));
    }

    if (sets.length === 0) return this.findById(id);

    sets.push(`updated_at = NOW()`);
    params.push(id);

    const result = await this.pool.query(
      `UPDATE diagrams SET ${sets.join(', ')} WHERE id = $${idx}
       RETURNING id, name, description, graph, created_at, updated_at`,
      params,
    );
    return result.rows[0] ?? null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM diagrams WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }
}
