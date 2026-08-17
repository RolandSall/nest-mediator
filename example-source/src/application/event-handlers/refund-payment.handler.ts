import { Injectable, Logger } from '@nestjs/common';
import { EventHandler, IEventConsumer, MediatorBus, Critical } from '@nest-mediator/core';
import { OrderCancelledEvent, PaymentRefundedEvent } from '../../domain/events';

@Injectable()
@EventHandler(OrderCancelledEvent)
@Critical({ order: 2 })
export class RefundPaymentHandler implements IEventConsumer<OrderCancelledEvent> {
  private readonly logger = new Logger(RefundPaymentHandler.name);

  constructor(private readonly mediatorBus: MediatorBus) {}

  async handle(event: OrderCancelledEvent): Promise<void> {
    this.logger.log(`[Payment] Refunded payment for order ${event.orderId}`);

    await this.mediatorBus.publish(
      new PaymentRefundedEvent(event.orderId),
    );
  }
}
