import { Injectable, Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler, MediatorBus } from '@nest-mediator/core';
import { CancelOrderCommand } from './cancel-order.command';
import { ORDER_PERSISTOR, IOrderPersistor } from './order-persistor.port';
import { OrderCancelledEvent } from '../../domain/events';
import { OrderNotFoundException } from '../../domain/exceptions';

@Injectable()
@CommandHandler(CancelOrderCommand)
export class CancelOrderHandler implements ICommandHandler<CancelOrderCommand> {
  private readonly logger = new Logger(CancelOrderHandler.name);

  constructor(
    @Inject(ORDER_PERSISTOR) private readonly orderPersistor: IOrderPersistor,
    private readonly mediatorBus: MediatorBus,
  ) {}

  async execute(command: CancelOrderCommand): Promise<void> {
    const order = await this.orderPersistor.findById(command.orderId);
    if (!order) {
      throw new OrderNotFoundException(command.orderId);
    }
    if (order.status === 'cancelled') {
      throw new Error(`Order ${command.orderId} is already cancelled`);
    }

    this.logger.log(`Cancelling order ${command.orderId}: ${command.reason}`);

    // 1. Update order status (source of truth)
    await this.orderPersistor.updateStatus(command.orderId, 'cancelled', command.reason);

    // 2. Publish domain event AFTER updating - triggers side effects
    await this.mediatorBus.publish(
      new OrderCancelledEvent(command.orderId, command.reason),
    );

    this.logger.log(`Order ${command.orderId} cancelled successfully`);
  }
}
