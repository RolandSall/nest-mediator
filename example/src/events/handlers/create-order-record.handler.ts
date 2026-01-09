import { Injectable, Logger } from '@nestjs/common';
import { EventHandler, IEventHandler, Critical } from '@rolandsall24/nest-mediator';
import { OrderPlacedEvent } from '../order-placed.event';

/**
 * Critical handler: Creates the order record in the database
 * Runs after inventory reservation (order: 3)
 */
@Injectable()
@EventHandler(OrderPlacedEvent)
@Critical({ order: 3 })
export class CreateOrderRecordHandler implements IEventHandler<OrderPlacedEvent> {
  private readonly logger = new Logger(CreateOrderRecordHandler.name);

  async handle(event: OrderPlacedEvent): Promise<void> {
    this.logger.log(`[CRITICAL] Creating order record for order ${event.orderId}...`);

    // Simulate database insert
    await this.delay(80);

    this.logger.log(`[CRITICAL] Order record created: {
  orderId: "${event.orderId}",
  customerId: "${event.customerId}",
  total: $${event.total},
  itemCount: ${event.items.length}
}`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
