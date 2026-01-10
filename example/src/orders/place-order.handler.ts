import { Injectable, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler, MediatorBus } from '@rolandsall24/nest-mediator';
import { PlaceOrderCommand } from './place-order.command';
import { OrderPlacedEvent } from '../events';

@Injectable()
@CommandHandler(PlaceOrderCommand)
export class PlaceOrderHandler implements ICommandHandler<PlaceOrderCommand> {
  private readonly logger = new Logger(PlaceOrderHandler.name);

  constructor(private readonly mediatorBus: MediatorBus) {}

  async execute(command: PlaceOrderCommand): Promise<void> {
    const orderId = `order-${Date.now()}`;

    this.logger.log(`Processing order ${orderId} for customer ${command.customerId}`);

    // Simulate order processing logic
    // In real app: validate stock, calculate totals, create order record, etc.
    await this.simulateOrderProcessing(orderId, command);

    this.logger.log(`Order ${orderId} processed, publishing OrderPlacedEvent`);

    // Publish domain event after successful command execution
    // Critical consumers run sequentially, non-critical run in background
    await this.mediatorBus.publish(
      new OrderPlacedEvent(
        orderId,
        command.customerId,
        command.items,
        command.total,
        command.simulatePaymentFailure,
      ),
    );

    this.logger.log(`Order ${orderId} completed successfully`);
  }

  private async simulateOrderProcessing(
    orderId: string,
    command: PlaceOrderCommand,
  ): Promise<void> {
    // Simulate some processing time
    await new Promise((resolve) => setTimeout(resolve, 50));
    this.logger.debug(
      `Order ${orderId}: ${command.items.length} items, total: $${command.total}`,
    );
  }
}
