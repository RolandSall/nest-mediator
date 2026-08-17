import { IEvent, DomainEvent } from '@nest-mediator/core';

@DomainEvent('Order', 'orderId')
export class OrderPlacedEvent implements IEvent {
  constructor(
    public readonly orderId: string,
    public readonly customerId: string,
    public readonly items: { productId: string; quantity: number }[],
    public readonly total: number,
  ) {}
}
