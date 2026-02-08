import { IEvent } from '@rolandsall24/nest-mediator';

export class CancellationEmailSentEvent implements IEvent {
  constructor(
    public readonly orderId: string,
  ) {}
}
