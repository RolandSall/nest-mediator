import { IEvent } from '@rolandsall24/nest-mediator';

export class ConfirmationEmailSentEvent implements IEvent {
  constructor(
    public readonly orderId: string,
    public readonly customerId: string,
  ) {}
}
