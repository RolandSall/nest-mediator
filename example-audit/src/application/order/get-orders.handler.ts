import { Injectable, Inject } from '@nestjs/common';
import { QueryHandler, IQueryHandler } from '@nest-mediator/core';
import { GetOrdersQuery } from './get-orders.query';
import { ORDER_PERSISTOR, IOrderPersistor } from './order-persistor.port';
import { Order } from '../../domain/entities';

@Injectable()
@QueryHandler(GetOrdersQuery)
export class GetOrdersHandler implements IQueryHandler<GetOrdersQuery, Order[]> {
  constructor(
    @Inject(ORDER_PERSISTOR) private readonly orderPersistor: IOrderPersistor,
  ) {}

  async execute(_query: GetOrdersQuery): Promise<Order[]> {
    return this.orderPersistor.findAll();
  }
}
