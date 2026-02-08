import { Injectable } from '@nestjs/common';
import {
  AggregateRepository,
  ForAggregate,
} from '@rolandsall24/nest-mediator';
import { OrderAggregate } from '../../../domain/entities/order.aggregate';

@Injectable()
@ForAggregate(OrderAggregate)
export class OrderAggregateRepository
  extends AggregateRepository<OrderAggregate, string> {}
