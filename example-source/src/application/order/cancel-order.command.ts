import { ICommand } from '@rolandsall24/nest-mediator';

export class CancelOrderCommand implements ICommand {
  constructor(
    public readonly orderId: string,
    public readonly reason: string,
  ) {}
}
