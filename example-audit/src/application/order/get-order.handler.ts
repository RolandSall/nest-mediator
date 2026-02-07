import { Injectable, Inject } from '@nestjs/common';
import { QueryHandler, IQueryHandler } from '@rolandsall24/nest-mediator';
import { GetOrderQuery } from './get-order.query';
import { ORDER_PERSISTOR, IOrderPersistor } from './order-persistor.port';
import { Order } from '../../domain/entities';

@Injectable()
@QueryHandler(GetOrderQuery)
export class GetOrderHandler implements IQueryHandler<GetOrderQuery, Order | null> {
  constructor(
    @Inject(ORDER_PERSISTOR) private readonly orderPersistor: IOrderPersistor,
  ) {}

  async execute(query: GetOrderQuery): Promise<Order | null> {
    return this.orderPersistor.findById(query.orderId);
  }
}
