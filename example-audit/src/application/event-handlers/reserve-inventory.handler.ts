import { Injectable, Logger } from '@nestjs/common';
import { EventHandler, ICriticalEventConsumer, IEvent, MediatorBus, Critical } from '@nest-mediator/core';
import { OrderPlacedEvent, InventoryReservedEvent, InventoryReleasedEvent } from '../../domain/events';

@Injectable()
@EventHandler(OrderPlacedEvent)
@Critical({ order: 1 })
export class ReserveInventoryHandler implements ICriticalEventConsumer<OrderPlacedEvent> {
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

  async applyCompensatingEvent(event: OrderPlacedEvent): Promise<IEvent> {
    this.logger.warn(`[Inventory] Compensating: releasing inventory for order ${event.orderId}`);
    return new InventoryReleasedEvent(event.orderId);
  }
}
