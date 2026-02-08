import { IEvent, DomainEvent } from '@rolandsall24/nest-mediator';

/**
 * SOURCE MODE: Events use @DomainEvent decorator for aggregate tracking.
 * Events are the source of truth - state is rebuilt by replaying them.
 */
@DomainEvent('Order', 'orderId')
export class OrderPlacedEvent implements IEvent {
  constructor(
    public readonly orderId: string,
    public readonly customerId: string,
    public readonly items: { productId: string; quantity: number }[],
    public readonly total: number,
  ) {}
}
