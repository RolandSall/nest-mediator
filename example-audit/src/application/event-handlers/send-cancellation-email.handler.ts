import { Injectable, Logger } from '@nestjs/common';
import { EventHandler, IEventConsumer, MediatorBus, Critical } from '@nest-mediator/core';
import { OrderCancelledEvent, CancellationEmailSentEvent } from '../../domain/events';

@Injectable()
@EventHandler(OrderCancelledEvent)
@Critical({ order: 3 })
export class SendCancellationEmailHandler implements IEventConsumer<OrderCancelledEvent> {
  private readonly logger = new Logger(SendCancellationEmailHandler.name);

  constructor(private readonly mediatorBus: MediatorBus) {}

  async handle(event: OrderCancelledEvent): Promise<void> {
    this.logger.log(`[Email] Sent cancellation notice for order ${event.orderId}`);

    await this.mediatorBus.publish(
      new CancellationEmailSentEvent(event.orderId),
    );
  }
}
