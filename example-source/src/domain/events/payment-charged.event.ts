import { IEvent } from '@nest-mediator/core';

export class PaymentChargedEvent implements IEvent {
  constructor(
    public readonly orderId: string,
    public readonly amount: number,
  ) {}
}
