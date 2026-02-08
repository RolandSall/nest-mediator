import { Injectable, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@rolandsall24/nest-mediator';
import { CancelOrderCommand } from './cancel-order.command';
import { OrderAggregateRepository } from '../../infrastructure/persistence/order';
import { OrderNotFoundException } from '../../domain/exceptions';

@Injectable()
@CommandHandler(CancelOrderCommand)
export class CancelOrderHandler implements ICommandHandler<CancelOrderCommand> {
  private readonly logger = new Logger(CancelOrderHandler.name);

  constructor(
    private readonly orderRepository: OrderAggregateRepository,
  ) {}

  async execute(command: CancelOrderCommand): Promise<void> {
    // Load aggregate (replays events to rebuild state + version)
    const order = await this.orderRepository.findById(command.orderId);
    if (!order) {
      throw new OrderNotFoundException(command.orderId);
    }

    this.logger.log(`Cancelling order ${command.orderId}: ${command.reason}`);

    // Apply business rules and record OrderCancelledEvent
    // Throws if order is already cancelled
    order.cancel(command.reason);

    // Save publishes the event with version check:
    // If another request modified this aggregate since we loaded it,
    // the event store will throw ConcurrencyError
    await this.orderRepository.save(order);

    this.logger.log(`Order ${command.orderId} cancelled successfully`);
  }
}
