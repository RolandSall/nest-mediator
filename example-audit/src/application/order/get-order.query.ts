import { IQuery } from '@nest-mediator/core';

export class GetOrderQuery implements IQuery {
  constructor(public readonly orderId: string) {}
}
