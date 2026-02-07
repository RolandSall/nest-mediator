import { Injectable, Logger } from '@nestjs/common';
import { EventHandler, IEventConsumer, MediatorBus, Critical } from '@rolandsall24/nest-mediator';
import { OrderPlacedEvent, InventoryReservedEvent } from '../../domain/events';

@Injectable()
@EventHandler(OrderPlacedEvent)
@Critical({ order: 1 })
export class ReserveInventoryHandler implements IEventConsumer<OrderPlacedEvent> {
  private readonly logger = new Logger(ReserveInventoryHandler.name);

  constructor(private readonly mediatorBus: MediatorBus) {}

  async handle(event: OrderPlacedEvent): Promise<void> {
    for (const item of event.items) {
      this.logger.log(`[Inventory] Reserved ${item.quantity}x ${item.productId}`);
    }

    await this.mediatorBus.publish(
      new InventoryReservedEvent(event.orderId, event.items),
    );
  }
}
