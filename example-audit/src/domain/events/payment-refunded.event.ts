import { IEvent, DomainEvent } from '@rolandsall24/nest-mediator';

@DomainEvent('Order', 'orderId')
export class PaymentRefundedEvent implements IEvent {
  constructor(
    public readonly orderId: string,
  ) {}
}
