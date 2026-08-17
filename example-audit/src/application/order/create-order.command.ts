import { ICommand } from '@nest-mediator/core';

export class CreateOrderCommand implements ICommand {
  constructor(
    public readonly customerId: string,
    public readonly items: { productId: string; quantity: number }[],
    public readonly total: number,
  ) {}
}
