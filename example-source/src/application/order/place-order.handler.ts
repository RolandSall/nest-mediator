import { Injectable, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@rolandsall24/nest-mediator';
import { PlaceOrderCommand } from './place-order.command';
import { OrderAggregateRepository } from '../../infrastructure/persistence/order';
import { OrderAggregate } from '../../domain/entities/order.aggregate';

@Injectable()
@CommandHandler(PlaceOrderCommand)
export class PlaceOrderHandler implements ICommandHandler<PlaceOrderCommand> {
  private readonly logger = new Logger(PlaceOrderHandler.name);

  constructor(
    private readonly orderRepository: OrderAggregateRepository,
  ) {}

  async execute(command: PlaceOrderCommand): Promise<void> {
    const orderId = command.orderId ?? `order-${Date.now()}`;

    this.logger.log(`Processing order ${orderId} for customer ${command.customerId}`);

    // Create aggregate - validates business rules and records OrderPlacedEvent
    const order = OrderAggregate.create(
      orderId,
      command.customerId,
      command.items,
      command.total,
    );

    // Save publishes uncommitted events through the event bus:
    // 1. Persisted to event store (with sequence number for concurrency)
    // 2. Critical consumers run (inventory, payment)
    // 3. Non-critical consumers dispatched (email, analytics)
    await this.orderRepository.save(order);

    this.logger.log(`Order ${orderId} completed successfully`);
  }
}
