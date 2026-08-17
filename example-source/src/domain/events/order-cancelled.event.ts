import { IEvent, DomainEvent } from '@nest-mediator/core';

@DomainEvent('Order', 'orderId')
export class OrderCancelledEvent implements IEvent {
  constructor(
    public readonly orderId: string,
    public readonly reason: string,
  ) {}
}
