import { IEvent, DomainEvent } from '@rolandsall24/nest-mediator';

@DomainEvent('Order', 'orderId')
export class InventoryReleasedEvent implements IEvent {
  constructor(
    public readonly orderId: string,
  ) {}
}
