import { Injectable, Logger } from '@nestjs/common';
import { EventHandler, IEventConsumer, MediatorBus } from '@rolandsall24/nest-mediator';
import { OrderPlacedEvent, ConfirmationEmailSentEvent } from '../../domain/events';

@Injectable()
@EventHandler(OrderPlacedEvent)
// No @Critical → defaults to non-critical (fire-and-forget via setImmediate)
export class SendConfirmationEmailHandler implements IEventConsumer<OrderPlacedEvent> {
  private readonly logger = new Logger(SendConfirmationEmailHandler.name);

  constructor(private readonly mediatorBus: MediatorBus) {}

  async handle(event: OrderPlacedEvent): Promise<void> {
    this.logger.log(`[Email] Sent confirmation to ${event.customerId}`);

    await this.mediatorBus.publish(
      new ConfirmationEmailSentEvent(event.orderId, event.customerId),
    );
  }
}
