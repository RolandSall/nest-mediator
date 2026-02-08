import { IEvent } from '@rolandsall24/nest-mediator';

export class InventoryReservedEvent implements IEvent {
  constructor(
    public readonly orderId: string,
    public readonly items: { productId: string; quantity: number }[],
  ) {}
}
