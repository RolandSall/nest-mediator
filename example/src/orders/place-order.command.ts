import { ICommand } from '@rolandsall24/nest-mediator';

export class PlaceOrderCommand implements ICommand {
  constructor(
    public readonly customerId: string,
    public readonly items: { productId: string; quantity: number }[],
    public readonly total: number,
    /** Set to true to simulate payment failure (for testing compensation) */
    public readonly simulatePaymentFailure: boolean = false,
  ) {}
}
