import { Injectable, Logger } from '@nestjs/common';
import { EventHandler, IEventHandler, Critical } from '@rolandsall24/nest-mediator';
import { OrderPlacedEvent } from '../order-placed.event';

/**
 * Critical handler: Reserves inventory for the order
 * Runs after validation (order: 2) and must succeed before non-critical handlers run
 */
@Injectable()
@EventHandler(OrderPlacedEvent)
@Critical({ order: 2 })
export class ReserveInventoryHandler implements IEventHandler<OrderPlacedEvent> {
  private readonly logger = new Logger(ReserveInventoryHandler.name);

  async handle(event: OrderPlacedEvent): Promise<void> {
    this.logger.log(`[CRITICAL] Reserving inventory for order ${event.orderId}...`);

    // Simulate inventory reservation
    await this.delay(150);

    for (const item of event.items) {
      this.logger.log(`  - Reserved ${item.quantity} units of product ${item.productId}`);
    }

    this.logger.log(`[CRITICAL] Inventory reserved successfully for order ${event.orderId}`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
