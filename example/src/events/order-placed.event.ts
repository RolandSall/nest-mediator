import { IEvent } from '@rolandsall24/nest-mediator';

/**
 * Event fired when an order is placed
 */
export class OrderPlacedEvent implements IEvent {
  constructor(
    public readonly orderId: string,
    public readonly customerId: string,
    public readonly items: { productId: string; quantity: number }[],
    public readonly total: number,
    /** Set to true to simulate payment failure (for testing compensation) */
    public readonly simulatePaymentFailure: boolean = false,
  ) {}
}
