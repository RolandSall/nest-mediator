import { IEvent } from '@nest-mediator/core';

export class CancellationEmailSentEvent implements IEvent {
  constructor(
    public readonly orderId: string,
  ) {}
}
