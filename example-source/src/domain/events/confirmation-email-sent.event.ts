import { IEvent } from '@nest-mediator/core';

export class ConfirmationEmailSentEvent implements IEvent {
  constructor(
    public readonly orderId: string,
    public readonly customerId: string,
  ) {}
}
