import { Controller, Get, Inject, Optional, Post } from '@nestjs/common';
import { MediatorBus, IEventStoreRepository, EVENT_STORE_REPOSITORY } from '@rolandsall24/nest-mediator';
import { CachingBehavior } from '../../application/behaviors';

/**
 * Showcases nest-mediator library internals:
 * - Event store audit log
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

  @Get('audit')
  async getAuditLog() {
    if (!this.eventStore) {
      return { error: 'Event store not configured. Set DATABASE_URL.' };
    }

    const pool = (this.eventStore as any).pool;
    if (!pool) return { error: 'Cannot access pool' };

    const result = await pool.query(
      `SELECT event_id, event_type, payload, occurred_at
       FROM audit_events ORDER BY occurred_at DESC LIMIT 50`,
    );

    return {
      mode: 'audit',
      count: result.rows.length,
      events: result.rows.map((r: any) => ({
        eventId: r.event_id,
        eventType: r.event_type,
        payload: r.payload,
        occurredAt: r.occurred_at,
      })),
    };
  }

  @Get('events')
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
      mode: 'audit',
      eventStoreEnabled: !!this.eventStore,
    };
  }
}
