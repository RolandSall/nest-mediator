import { IEvent, DomainEvent } from '@rolandsall24/nest-mediator';

@DomainEvent('Order', 'orderId')
export class ConfirmationEmailSentEvent implements IEvent {
  constructor(
    public readonly orderId: string,
    public readonly customerId: string,
  ) {}
}
