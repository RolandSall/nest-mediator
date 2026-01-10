import { Injectable, Logger } from '@nestjs/common';
import { EventHandler, ICriticalEventConsumer, Critical } from '@rolandsall24/nest-mediator';
import { OrderPlacedEvent } from '../order-placed.event';

/**
 * Critical handler: Creates the order record in the database
 * Runs after inventory reservation (order: 3)
 *
 * Implements ICriticalEventConsumer with compensate() to delete the order record
 * if a subsequent critical handler fails.
 *
 * NOTE: This handler simulates a random failure (30% chance) to demonstrate
 * the compensation/saga pattern. In production, this would be a real DB operation.
 */
@Injectable()
@EventHandler(OrderPlacedEvent)
@Critical({ order: 3 })
export class CreateOrderRecordHandler implements ICriticalEventConsumer<OrderPlacedEvent> {
  private readonly logger = new Logger(CreateOrderRecordHandler.name);

  // Set to true to simulate failures for testing compensation
  private readonly simulateFailure = process.env.SIMULATE_ORDER_FAILURE === 'true';

  async handle(event: OrderPlacedEvent): Promise<void> {
    this.logger.log(`[CRITICAL] Creating order record for order ${event.orderId}...`);

    // Simulate database insert
    await this.delay(80);

    // Simulate random failure to demonstrate compensation
    if (this.simulateFailure && Math.random() < 0.3) {
      throw new Error(`Database connection failed while creating order ${event.orderId}`);
    }

    this.logger.log(`[CRITICAL] Order record created: {
  orderId: "${event.orderId}",
  customerId: "${event.customerId}",
  total: $${event.total},
  itemCount: ${event.items.length}
}`);
  }

  /**
   * Compensation: Delete the order record
   * Called if a subsequent critical handler fails
   */
  async compensate(event: OrderPlacedEvent): Promise<void> {
    this.logger.warn(`[COMPENSATE] Deleting order record for order ${event.orderId}...`);

    // Simulate database delete
    await this.delay(50);

    this.logger.warn(`[COMPENSATE] Order record deleted for order ${event.orderId}`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
