import { IEvent, DomainEvent } from '@rolandsall24/nest-mediator';

@DomainEvent('Order', 'orderId')
export class InventoryReservedEvent implements IEvent {
  constructor(
    public readonly orderId: string,
    public readonly items: { productId: string; quantity: number }[],
  ) {}
}
