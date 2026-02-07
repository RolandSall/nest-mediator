import { Injectable, Logger } from '@nestjs/common';
import { EventHandler, IEventConsumer, MediatorBus, Critical } from '@rolandsall24/nest-mediator';
import { OrderCancelledEvent, InventoryReleasedEvent } from '../../domain/events';

@Injectable()
@EventHandler(OrderCancelledEvent)
@Critical({ order: 1 })
export class ReleaseInventoryHandler implements IEventConsumer<OrderCancelledEvent> {
  private readonly logger = new Logger(ReleaseInventoryHandler.name);

  constructor(private readonly mediatorBus: MediatorBus) {}

  async handle(event: OrderCancelledEvent): Promise<void> {
    this.logger.log(`[Inventory] Released inventory for order ${event.orderId}`);

    await this.mediatorBus.publish(
      new InventoryReleasedEvent(event.orderId),
    );
  }
}
