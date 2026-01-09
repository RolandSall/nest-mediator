import { ICommand } from '@rolandsall24/nest-mediator';

export class PlaceOrderCommand implements ICommand {
  constructor(
    public readonly customerId: string,
    public readonly items: { productId: string; quantity: number }[],
    public readonly total: number,
  ) {}
}
