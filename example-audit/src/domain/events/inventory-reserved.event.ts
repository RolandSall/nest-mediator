import { IEvent } from '@nest-mediator/core';

export class InventoryReservedEvent implements IEvent {
  constructor(
    public readonly orderId: string,
    public readonly items: { productId: string; quantity: number }[],
  ) {}
}
