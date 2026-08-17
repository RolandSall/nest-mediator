import { Injectable, Logger } from '@nestjs/common';
import { EventHandler, IEventConsumer } from '@nest-mediator/core';
import { InventoryReleasedEvent } from '../../domain/events';

@Injectable()
@EventHandler(InventoryReleasedEvent)
export class HandleInventoryReleasedHandler implements IEventConsumer<InventoryReleasedEvent> {
  private readonly logger = new Logger(HandleInventoryReleasedHandler.name);

  async handle(event: InventoryReleasedEvent): Promise<void> {
    this.logger.log(`[Inventory] Releasing reserved inventory for order ${event.orderId}`);
    // Actual inventory release logic would go here
  }
}
