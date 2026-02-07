import { IEvent, DomainEvent } from '@rolandsall24/nest-mediator';

@DomainEvent('Order', 'orderId')
export class OrderPlacedEvent implements IEvent {
  constructor(
    public readonly orderId: string,
    public readonly customerId: string,
    public readonly items: { productId: string; quantity: number }[],
    public readonly total: number,
  ) {}
}
