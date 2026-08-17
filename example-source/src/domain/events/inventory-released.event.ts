import { IEvent } from '@nest-mediator/core';

export class InventoryReleasedEvent implements IEvent {
  constructor(
    public readonly orderId: string,
  ) {}
}
