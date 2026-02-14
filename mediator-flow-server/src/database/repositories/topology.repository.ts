import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../constants';

@Injectable()
export class TopologyRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /**
   * Replace the entire topology for a service in a single transaction.
   * Deletes all existing entries then inserts the new ones,
   * ensuring removed handlers/events/behaviors don't linger as orphans.
   */
  async replaceTopology(topology: {
    serviceName: string;
    instanceId: string;
    bootedAt: string;
    libraryVersion: string;
    commands: { commandName: string; handlerName: string }[];
    queries: { queryName: string; handlerName: string }[];
    events: {
      eventName: string;
      aggregateType?: string;
      consumers: {
        consumerName: string;
        criticality: string;
        order: number;
        hasCompensation: boolean;
      }[];
    }[];
    behaviors: {
      behaviorName: string;
      priority: number;
      scope: string;
      requestTypeName?: string;
    }[];
    aggregates: {
      aggregateType: string;
      repositoryName: string;
      eventTypes: string[];
    }[];
  }) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const sn = topology.serviceName;

      // Upsert service record
      await client.query(
        `INSERT INTO services (service_name, instance_id, booted_at, library_version, last_seen_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (service_name, instance_id) DO UPDATE
         SET booted_at = $3, library_version = $4, last_seen_at = NOW()`,
        [sn, topology.instanceId, topology.bootedAt, topology.libraryVersion],
      );

      // Delete existing topology for this service (cascade removes consumers)
      await client.query('DELETE FROM topology_events WHERE service_name = $1', [sn]);
      await client.query('DELETE FROM topology_commands WHERE service_name = $1', [sn]);
      await client.query('DELETE FROM topology_queries WHERE service_name = $1', [sn]);
      await client.query('DELETE FROM topology_behaviors WHERE service_name = $1', [sn]);
      await client.query('DELETE FROM topology_aggregates WHERE service_name = $1', [sn]);

      // Insert commands
      for (const cmd of topology.commands) {
        await client.query(
          `INSERT INTO topology_commands (service_name, command_name, handler_name)
           VALUES ($1, $2, $3)`,
          [sn, cmd.commandName, cmd.handlerName],
        );
      }

      // Insert queries
      for (const q of topology.queries) {
        await client.query(
          `INSERT INTO topology_queries (service_name, query_name, handler_name)
           VALUES ($1, $2, $3)`,
          [sn, q.queryName, q.handlerName],
        );
      }

      // Insert events and consumers
      for (const evt of topology.events) {
        const result = await client.query(
          `INSERT INTO topology_events (service_name, event_name, aggregate_type)
           VALUES ($1, $2, $3)
           RETURNING id`,
          [sn, evt.eventName, evt.aggregateType ?? null],
        );
        const eventId = result.rows[0].id;

        for (const consumer of evt.consumers) {
          await client.query(
            `INSERT INTO topology_consumers (topology_event_id, consumer_name, criticality, consumer_order, has_compensation)
             VALUES ($1, $2, $3, $4, $5)`,
            [eventId, consumer.consumerName, consumer.criticality, consumer.order, consumer.hasCompensation],
          );
        }
      }

      // Insert behaviors
      for (const b of topology.behaviors) {
        await client.query(
          `INSERT INTO topology_behaviors (service_name, behavior_name, priority, scope, request_type_name)
           VALUES ($1, $2, $3, $4, $5)`,
          [sn, b.behaviorName, b.priority, b.scope, b.requestTypeName ?? null],
        );
      }

      // Insert aggregates
      for (const a of topology.aggregates) {
        await client.query(
          `INSERT INTO topology_aggregates (service_name, aggregate_type, repository_name, event_types)
           VALUES ($1, $2, $3, $4)`,
          [sn, a.aggregateType, a.repositoryName, a.eventTypes],
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getTopology(serviceName?: string) {
    const where = serviceName ? 'WHERE service_name = $1' : '';
    const params = serviceName ? [serviceName] : [];

    const [commands, queries, events, behaviors, aggregates, services] = await Promise.all([
      this.pool.query(`SELECT * FROM topology_commands ${where}`, params),
      this.pool.query(`SELECT * FROM topology_queries ${where}`, params),
      this.pool.query(
        `SELECT e.*, json_agg(json_build_object(
          'consumerName', c.consumer_name,
          'criticality', c.criticality,
          'order', c.consumer_order,
          'hasCompensation', c.has_compensation
        )) FILTER (WHERE c.id IS NOT NULL) AS consumers
         FROM topology_events e
         LEFT JOIN topology_consumers c ON c.topology_event_id = e.id
         ${where} GROUP BY e.id`,
        params,
      ),
      this.pool.query(`SELECT * FROM topology_behaviors ${where}`, params),
      this.pool.query(`SELECT * FROM topology_aggregates ${where}`, params),
      this.pool.query(`SELECT * FROM services ${where}`, params),
    ]);

    return {
      services: services.rows,
      commands: commands.rows.map((r: any) => ({
        commandName: r.command_name,
        handlerName: r.handler_name,
        serviceName: r.service_name,
      })),
      queries: queries.rows.map((r: any) => ({
        queryName: r.query_name,
        handlerName: r.handler_name,
        serviceName: r.service_name,
      })),
      events: events.rows.map((r: any) => ({
        eventName: r.event_name,
        aggregateType: r.aggregate_type,
        serviceName: r.service_name,
        consumers: r.consumers ?? [],
      })),
      behaviors: behaviors.rows.map((r: any) => ({
        behaviorName: r.behavior_name,
        priority: r.priority,
        scope: r.scope,
        requestTypeName: r.request_type_name,
        serviceName: r.service_name,
      })),
      aggregates: aggregates.rows.map((r: any) => ({
        aggregateType: r.aggregate_type,
        repositoryName: r.repository_name,
        eventTypes: r.event_types,
        serviceName: r.service_name,
      })),
    };
  }

  /**
   * Delete topology for services that haven't reported in `days` days.
   * Returns the number of stale services removed.
   */
  async deleteStaleTopology(days: number): Promise<number> {
    const result = await this.pool.query(
      `SELECT DISTINCT service_name FROM services
       WHERE last_seen_at < NOW() - INTERVAL '1 day' * $1`,
      [days],
    );

    const staleServices = result.rows.map((r: any) => r.service_name);
    if (staleServices.length === 0) return 0;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const sn of staleServices) {
        await client.query('DELETE FROM topology_events WHERE service_name = $1', [sn]);
        await client.query('DELETE FROM topology_commands WHERE service_name = $1', [sn]);
        await client.query('DELETE FROM topology_queries WHERE service_name = $1', [sn]);
        await client.query('DELETE FROM topology_behaviors WHERE service_name = $1', [sn]);
        await client.query('DELETE FROM topology_aggregates WHERE service_name = $1', [sn]);
        await client.query('DELETE FROM services WHERE service_name = $1', [sn]);
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return staleServices.length;
  }
}
