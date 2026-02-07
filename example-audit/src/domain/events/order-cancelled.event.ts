import { IEvent, DomainEvent } from '@rolandsall24/nest-mediator';

@DomainEvent('Order', 'orderId')
export class OrderCancelledEvent implements IEvent {
  constructor(
    public readonly orderId: string,
    public readonly reason: string,
  ) {}
}
