import { Body, Controller, Get, Param, Post, Inject } from '@nestjs/common';
import { MediatorBus, IEventStoreRepository, EVENT_STORE_REPOSITORY } from '@rolandsall24/nest-mediator';
import {
  PlaceOrderCommand,
  CancelOrderCommand,
  GetOrderQuery,
} from '../../application/order';
import { CreateOrderApiRequest, CancelOrderApiRequest } from './create-order-api.request';

@Controller()
export class OrderController {
  constructor(
    private readonly mediator: MediatorBus,
    @Inject(EVENT_STORE_REPOSITORY) private readonly eventStore: IEventStoreRepository,
  ) {}

  @Get()
  info() {
    return {
      mode: 'SOURCE',
      description: 'Orders rebuilt from events in domain_events table',
      note: 'Query /orders/:id to get state rebuilt from events (no order table)',
    };
  }

  @Post('orders')
  async placeOrder(@Body() body: CreateOrderApiRequest) {
    await this.mediator.send(
      new PlaceOrderCommand(body.customerId, body.items, body.total),
    );
    return { success: true, message: 'Order placed successfully' };
  }

  @Post('orders/:id/cancel')
  async cancelOrder(@Param('id') orderId: string, @Body() body: CancelOrderApiRequest) {
    await this.mediator.send(
      new CancelOrderCommand(orderId, body.reason),
    );
    return { success: true, message: `Order ${orderId} cancelled` };
  }

  @Get('orders/:id')
  async getOrder(@Param('id') orderId: string) {
    const order = await this.mediator.query(new GetOrderQuery(orderId));
    if (!order) {
      return { error: 'Order not found (no events for this aggregate)' };
    }
    return {
      ...order,
      note: 'State rebuilt from events in domain_events table',
    };
  }

  @Get('orders/:id/events')
  async getOrderEvents(@Param('id') orderId: string) {
    if (!this.eventStore) {
      return { error: 'Event store not configured. Set DATABASE_URL.' };
    }

    const events = await this.eventStore.getEventsForAggregate('Order', orderId);

    return {
      orderId,
      eventCount: events.length,
      events: events.map(e => ({
        eventId: e.eventId,
        eventType: e.eventType,
        sequenceNumber: e.sequenceNumber,
        payload: e.payload,
        occurredAt: e.occurredAt,
      })),
    };
  }

  /**
   * Demonstrates optimistic concurrency control.
   * Places an order, then fires two cancel commands simultaneously.
   * One succeeds, the other fails with ConcurrencyError.
   */
  @Post('orders/test-concurrency')
  async testConcurrency() {
    if (!this.eventStore) {
      return { error: 'Event store not configured. Set DATABASE_URL to test concurrency.' };
    }

    const orderId = `order-concurrency-${Date.now()}`;

    // Step 1: Place an order with a known ID
    await this.mediator.send(
      new PlaceOrderCommand('concurrency-test-customer', [{ productId: 'prod-1', quantity: 1 }], 99.99, orderId),
    );

    // Step 2: Fire two cancel commands simultaneously
    // Both load the aggregate at version N, but only one can write version N+1
    const [resultA, resultB] = await Promise.allSettled([
      this.mediator.send(new CancelOrderCommand(orderId, 'Cancel reason A')),
      this.mediator.send(new CancelOrderCommand(orderId, 'Cancel reason B')),
    ]);

    // Step 3: Get final state
    const finalState = await this.mediator.query(new GetOrderQuery(orderId));

    return {
      orderId,
      cancelAttemptA: {
        status: resultA.status,
        error: resultA.status === 'rejected' ? (resultA.reason as Error).message : undefined,
      },
      cancelAttemptB: {
        status: resultB.status,
        error: resultB.status === 'rejected' ? (resultB.reason as Error).message : undefined,
      },
      finalState,
      explanation:
        'Both cancel commands loaded the aggregate at the same version. ' +
        'The first to persist wins; the second gets ConcurrencyError ' +
        'because the version has advanced.',
    };
  }
}
