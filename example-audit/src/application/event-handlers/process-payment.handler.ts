import { Injectable, Logger } from '@nestjs/common';
import { EventHandler, ICriticalEventConsumer, IEvent, MediatorBus, Critical } from '@rolandsall24/nest-mediator';
import { OrderPlacedEvent, PaymentChargedEvent, PaymentRefundedEvent } from '../../domain/events';

@Injectable()
@EventHandler(OrderPlacedEvent)
@Critical({ order: 2 })
export class ProcessPaymentHandler implements ICriticalEventConsumer<OrderPlacedEvent> {
  private readonly logger = new Logger(ProcessPaymentHandler.name);

  constructor(private readonly mediatorBus: MediatorBus) {}

  async handle(event: OrderPlacedEvent): Promise<void> {
    this.logger.log(`[Payment] Charged $${event.total} for order ${event.orderId}`);

    await this.mediatorBus.publish(
      new PaymentChargedEvent(event.orderId, event.total),
    );
  }

  async applyCompensatingEvent(event: OrderPlacedEvent): Promise<IEvent> {
    this.logger.warn(`[Payment] Compensating: refunding payment for order ${event.orderId}`);
    return new PaymentRefundedEvent(event.orderId);
  }
}
