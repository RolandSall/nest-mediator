import { Injectable, Logger } from '@nestjs/common';
import { EventHandler, ICriticalEventConsumer, IEvent, MediatorBus, Critical } from '@rolandsall24/nest-mediator';
import { OrderPlacedEvent, InventoryReservedEvent, InventoryReleasedEvent } from '../../domain/events';
import { ChaosService } from '../chaos/chaos.service';
import { SimulatedFailureError } from '../../domain/exceptions';

@Injectable()
@EventHandler(OrderPlacedEvent)
@Critical({ order: 1 })
export class ReserveInventoryHandler implements ICriticalEventConsumer<OrderPlacedEvent> {
  private readonly logger = new Logger(ReserveInventoryHandler.name);

  constructor(
    private readonly mediatorBus: MediatorBus,
    private readonly chaosService: ChaosService,
  ) {}

  async handle(event: OrderPlacedEvent): Promise<void> {
    if (this.chaosService.shouldFail('inventory')) {
      this.logger.error(`[Inventory] SIMULATED FAILURE for order ${event.orderId}`);
      throw new SimulatedFailureError('inventory');
    }

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
