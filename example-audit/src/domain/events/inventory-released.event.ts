import { IEvent } from '@rolandsall24/nest-mediator';

export class InventoryReleasedEvent implements IEvent {
  constructor(
    public readonly orderId: string,
  ) {}
}
