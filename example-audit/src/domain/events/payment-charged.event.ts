import { IEvent } from '@rolandsall24/nest-mediator';

export class PaymentChargedEvent implements IEvent {
  constructor(
    public readonly orderId: string,
    public readonly amount: number,
  ) {}
}
