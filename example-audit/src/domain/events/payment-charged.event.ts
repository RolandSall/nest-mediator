import { IEvent, DomainEvent } from '@rolandsall24/nest-mediator';

@DomainEvent('Order', 'orderId')
export class PaymentChargedEvent implements IEvent {
  constructor(
    public readonly orderId: string,
    public readonly amount: number,
  ) {}
}
