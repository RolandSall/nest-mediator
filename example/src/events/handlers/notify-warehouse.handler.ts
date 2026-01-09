import { Injectable, Logger } from '@nestjs/common';
import { EventHandler, IEventHandler } from '@rolandsall24/nest-mediator';
import { OrderPlacedEvent } from '../order-placed.event';

/**
 * Non-critical handler: Notifies the warehouse about the new order
 * Default is non-critical when @Critical is not specified
 * Fire-and-forget - failures don't affect the order placement
 */
@Injectable()
@EventHandler(OrderPlacedEvent)
export class NotifyWarehouseHandler implements IEventHandler<OrderPlacedEvent> {
  private readonly logger = new Logger(NotifyWarehouseHandler.name);

  async handle(event: OrderPlacedEvent): Promise<void> {
    this.logger.log(`[NON-CRITICAL] Notifying warehouse about order ${event.orderId}...`);

    // Simulate warehouse notification
    await this.delay(300);

    this.logger.log(`[NON-CRITICAL] Warehouse notified for order ${event.orderId}:
  - Items to pick: ${event.items.length}
  - Customer: ${event.customerId}`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
