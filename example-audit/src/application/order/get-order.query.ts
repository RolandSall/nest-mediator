import { IQuery } from '@rolandsall24/nest-mediator';

export class GetOrderQuery implements IQuery {
  constructor(public readonly orderId: string) {}
}
