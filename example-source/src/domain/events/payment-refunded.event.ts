import { IEvent } from '@rolandsall24/nest-mediator';

export class PaymentRefundedEvent implements IEvent {
  constructor(
    public readonly orderId: string,
  ) {}
}
