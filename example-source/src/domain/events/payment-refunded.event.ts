import { IEvent } from '@nest-mediator/core';

export class PaymentRefundedEvent implements IEvent {
  constructor(
    public readonly orderId: string,
  ) {}
}
