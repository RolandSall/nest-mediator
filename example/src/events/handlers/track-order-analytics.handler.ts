import { Injectable, Logger } from '@nestjs/common';
import { EventHandler, IEventHandler } from '@rolandsall24/nest-mediator';
import { OrderPlacedEvent } from '../order-placed.event';

/**
 * Non-critical handler: Tracks order analytics
 * Default is non-critical when @Critical is not specified
 * Fire-and-forget - failures don't affect the order placement
 */
@Injectable()
@EventHandler(OrderPlacedEvent)
export class TrackOrderAnalyticsHandler implements IEventHandler<OrderPlacedEvent> {
  private readonly logger = new Logger(TrackOrderAnalyticsHandler.name);

  async handle(event: OrderPlacedEvent): Promise<void> {
    this.logger.log(`[NON-CRITICAL] Tracking analytics for order ${event.orderId}...`);

    // Simulate analytics tracking
    await this.delay(200);

    this.logger.log(`[NON-CRITICAL] Analytics tracked:
  - Event: order_placed
  - Order ID: ${event.orderId}
  - Total: $${event.total}
  - Items: ${event.items.length}`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
