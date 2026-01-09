import { Injectable, Logger } from '@nestjs/common';
import { EventHandler, IEventHandler, NonCritical } from '@rolandsall24/nest-mediator';
import { OrderPlacedEvent } from '../order-placed.event';

/**
 * Non-critical handler: Sends order confirmation email
 * Runs in parallel with other non-critical handlers after all critical handlers complete
 * Fire-and-forget - failures don't affect the order placement
 */
@Injectable()
@EventHandler(OrderPlacedEvent)
@NonCritical()
export class SendOrderConfirmationHandler implements IEventHandler<OrderPlacedEvent> {
  private readonly logger = new Logger(SendOrderConfirmationHandler.name);

  async handle(event: OrderPlacedEvent): Promise<void> {
    this.logger.log(`[NON-CRITICAL] Sending order confirmation email for order ${event.orderId}...`);

    // Simulate email sending
    await this.delay(500);

    this.logger.log(`[NON-CRITICAL] Order confirmation email sent to customer ${event.customerId}`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
