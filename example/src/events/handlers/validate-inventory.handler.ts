import { Injectable, Logger } from '@nestjs/common';
import { EventHandler, IEventConsumer, Critical } from '@rolandsall24/nest-mediator';
import { OrderPlacedEvent } from '../order-placed.event';

/**
 * Critical handler: Validates that inventory is available for the order
 * Runs first (order: 1) and must succeed before other handlers run
 *
 * Note: Validation is read-only, so no compensation is needed.
 * We use IEventConsumer (not ICriticalEventConsumer) since there's nothing to rollback.
 */
@Injectable()
@EventHandler(OrderPlacedEvent)
@Critical({ order: 1 })
export class ValidateInventoryHandler implements IEventConsumer<OrderPlacedEvent> {
  private readonly logger = new Logger(ValidateInventoryHandler.name);

  async handle(event: OrderPlacedEvent): Promise<void> {
    this.logger.log(`[CRITICAL] Validating inventory for order ${event.orderId}...`);

    // Simulate inventory check
    await this.delay(100);

    // Simulate validation logic
    for (const item of event.items) {
      this.logger.log(`  - Checking stock for product ${item.productId}: ${item.quantity} units`);
    }

    this.logger.log(`[CRITICAL] Inventory validated successfully for order ${event.orderId}`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
