import { Controller, Get, Inject, Optional, Post } from '@nestjs/common';
import { MediatorBus, IEventStoreRepository, EVENT_STORE_REPOSITORY } from '@nest-mediator/core';
import { CachingBehavior } from '../../application/behaviors';

/**
 * Showcases nest-mediator library internals:
 * - Event store domain events
 * - Registered events & handlers
 * - Cache management
 * - System status
 */
@Controller('internals')
export class InternalsController {
  constructor(
    private readonly mediator: MediatorBus,
    @Optional() @Inject(EVENT_STORE_REPOSITORY) private readonly eventStore?: IEventStoreRepository,
  ) {}

  @Get('events')
  async getDomainEvents() {
    if (!this.eventStore) {
      return { error: 'Event store not configured. Set DATABASE_URL.' };
    }

    const pool = (this.eventStore as any).pool;
    if (!pool) return { error: 'Cannot access pool' };

    const result = await pool.query(
      `SELECT event_id, event_type, payload, occurred_at, correlation_id, causation_id, aggregate_type, aggregate_id, sequence_number
       FROM domain_events ORDER BY occurred_at DESC LIMIT 50`,
    );

    return {
      mode: 'source',
      count: result.rows.length,
      events: result.rows.map((r: any) => ({
        eventId: r.event_id,
        eventType: r.event_type,
        payload: r.payload,
        occurredAt: r.occurred_at,
        correlationId: r.correlation_id,
        causationId: r.causation_id,
        aggregateType: r.aggregate_type,
        aggregateId: r.aggregate_id,
        sequenceNumber: r.sequence_number,
      })),
    };
  }

  @Get('registered')
  getRegisteredEvents() {
    return this.mediator.getRegisteredEvents();
  }

  @Post('cache/clear')
  clearCache() {
    CachingBehavior.clearCache();
    return { message: 'Cache cleared' };
  }

  @Get('status')
  getStatus() {
    return {
      mode: 'source',
      eventStoreEnabled: !!this.eventStore,
      hint: this.eventStore
        ? 'Event store active - orders rebuilt from events'
        : 'Set DATABASE_URL to enable event sourcing',
    };
  }
}
