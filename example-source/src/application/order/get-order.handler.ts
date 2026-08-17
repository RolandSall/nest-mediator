import { Injectable } from '@nestjs/common';
import { QueryHandler, IQueryHandler } from '@nest-mediator/core';
import { GetOrderQuery } from './get-order.query';
import { OrderAggregateRepository } from '../../infrastructure/persistence/order';

@Injectable()
@QueryHandler(GetOrderQuery)
export class GetOrderHandler implements IQueryHandler<GetOrderQuery, any> {
  constructor(
    private readonly orderRepository: OrderAggregateRepository,
  ) {}

  async execute(query: GetOrderQuery): Promise<any> {
    const order = await this.orderRepository.findById(query.orderId);
    if (!order) {
      return null;
    }

    return {
      orderId: order.id,
      customerId: order.customerId,
      items: order.items,
      total: order.total,
      status: order.status,
      cancelReason: order.cancelReason,
      version: order.version,
    };
  }
}
