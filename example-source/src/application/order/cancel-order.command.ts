import { ICommand } from '@nest-mediator/core';

export class CancelOrderCommand implements ICommand {
  constructor(
    public readonly orderId: string,
    public readonly reason: string,
  ) {}
}
