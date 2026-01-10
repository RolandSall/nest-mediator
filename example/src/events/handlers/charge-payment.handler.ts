import { Injectable, Logger } from '@nestjs/common';
import { EventHandler, ICriticalEventConsumer, Critical } from '@rolandsall24/nest-mediator';
import { OrderPlacedEvent } from '../order-placed.event';

/**
 * Critical handler: Charges the customer's payment method
 * Runs after order record creation (order: 4)
 *
 * Implements ICriticalEventConsumer with compensate() to refund the payment
 * if a subsequent critical handler fails.
 *
 * NOTE: This handler simulates a failure when the "simulateFailure" flag is set
 * in the event, to demonstrate the compensation/saga pattern.
 */
@Injectable()
@EventHandler(OrderPlacedEvent)
@Critical({ order: 4 })
export class ChargePaymentHandler implements ICriticalEventConsumer<OrderPlacedEvent> {
  private readonly logger = new Logger(ChargePaymentHandler.name);

  async handle(event: OrderPlacedEvent): Promise<void> {
    this.logger.log(`[CRITICAL] Charging payment for order ${event.orderId}...`);
    this.logger.log(`  - Amount: $${event.total}`);
    this.logger.log(`  - Customer: ${event.customerId}`);

    // Simulate payment processing
    await this.delay(200);

    // Simulate failure if flag is set (for testing compensation)
    if ((event as any).simulatePaymentFailure) {
      throw new Error(`Payment gateway timeout for order ${event.orderId}`);
    }

    this.logger.log(`[CRITICAL] Payment charged successfully for order ${event.orderId}`);
  }

  /**
   * Compensation: Refund the payment
   * Called if a subsequent critical handler fails
   */
  async compensate(event: OrderPlacedEvent): Promise<void> {
    this.logger.warn(`[COMPENSATE] Refunding payment for order ${event.orderId}...`);
    this.logger.warn(`  - Amount: $${event.total}`);

    // Simulate refund processing
    await this.delay(150);

    this.logger.warn(`[COMPENSATE] Payment refunded for order ${event.orderId}`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
