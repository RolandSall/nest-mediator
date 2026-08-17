import { Injectable, Logger } from '@nestjs/common';
import { EventHandler, IEventConsumer } from '@nest-mediator/core';
import { PaymentRefundedEvent } from '../../domain/events';

@Injectable()
@EventHandler(PaymentRefundedEvent)
export class HandlePaymentRefundedHandler implements IEventConsumer<PaymentRefundedEvent> {
  private readonly logger = new Logger(HandlePaymentRefundedHandler.name);

  async handle(event: PaymentRefundedEvent): Promise<void> {
    this.logger.log(`[Payment] Processing refund for order ${event.orderId}`);
    // Actual payment refund logic would go here
  }
}
