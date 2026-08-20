import { Injectable, Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler, MediatorBus } from '@nest-mediator/core';
import { CreateOrderCommand } from './create-order.command';
import { ORDER_PERSISTOR, IOrderPersistor } from './order-persistor.port';
import { OrderPlacedEvent } from '../../domain/events';

@Injectable()
@CommandHandler(CreateOrderCommand)
export class CreateOrderHandler implements ICommandHandler<CreateOrderCommand, string> {
  private readonly logger = new Logger(CreateOrderHandler.name);

  constructor(
    @Inject(ORDER_PERSISTOR) private readonly orderPersistor: IOrderPersistor,
    private readonly mediatorBus: MediatorBus,
  ) {}

  async execute(command: CreateOrderCommand): Promise<string> {
    const orderId = `order-${Date.now()}`;

    this.logger.log(`Creating order ${orderId} for customer ${command.customerId}`);

    // 1. Save order (source of truth in audit mode)
    await this.orderPersistor.save({
      orderId,
      customerId: command.customerId,
      items: command.items,
      total: command.total,
      status: 'placed',
      createdAt: new Date(),
    });

    // 2. Publish domain event AFTER saving - triggers side effects
    await this.mediatorBus.publish(
      new OrderPlacedEvent(orderId, command.customerId, command.items, command.total),
    );

    this.logger.log(`Order ${orderId} created successfully`);

    // Return the generated id to the caller — the handler owns id generation,
    // so this is the only place it exists.
    return orderId;
  }
}
