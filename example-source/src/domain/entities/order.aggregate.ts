import { AggregateRoot } from '@rolandsall24/nest-mediator';
import { OrderPlacedEvent, OrderCancelledEvent } from '../events';

/**
 * SOURCE MODE: OrderAggregate encapsulates order business rules.
 * No database table needed - events are the source of truth.
 *
 * The aggregate has two roles:
 * 1. Command methods (create, cancel) enforce business rules and emit events
 * 2. Apply methods (applyXxxEvent) update internal state from events
 *
 * State is rebuilt by replaying events through the apply methods.
 */
export class OrderAggregate extends AggregateRoot<string> {
  private _orderId!: string;
  private _customerId!: string;
  private _items: { productId: string; quantity: number }[] = [];
  private _total: number = 0;
  private _status: 'placed' | 'cancelled' = 'placed';
  private _cancelReason?: string;

  readonly aggregateType = 'Order';

  get id(): string {
    return this._orderId;
  }

  get customerId(): string {
    return this._customerId;
  }

  get items(): { productId: string; quantity: number }[] {
    return [...this._items];
  }

  get total(): number {
    return this._total;
  }

  get status(): string {
    return this._status;
  }

  get cancelReason(): string | undefined {
    return this._cancelReason;
  }

  // ========================================
  // Command methods (enforce business rules)
  // ========================================

  /**
   * Factory: create a new order aggregate.
   * Validates inputs and emits OrderPlacedEvent.
   */
  static create(
    orderId: string,
    customerId: string,
    items: { productId: string; quantity: number }[],
    total: number,
  ): OrderAggregate {
    if (!items.length) {
      throw new Error('Order must have at least one item');
    }
    if (total <= 0) {
      throw new Error('Order total must be positive');
    }

    const order = new OrderAggregate();
    order.apply(new OrderPlacedEvent(orderId, customerId, items, total));
    return order;
  }

  /**
   * Cancel the order.
   * Validates the order can be cancelled and emits OrderCancelledEvent.
   */
  cancel(reason: string): void {
    if (this._status === 'cancelled') {
      throw new Error(`Order ${this._orderId} is already cancelled`);
    }
    this.apply(new OrderCancelledEvent(this._orderId, reason));
  }

  // ========================================
  // Event handlers (update state from events)
  // ========================================

  applyOrderPlacedEvent(event: OrderPlacedEvent): void {
    this._orderId = event.orderId;
    this._customerId = event.customerId;
    this._items = event.items;
    this._total = event.total;
    this._status = 'placed';
  }

  applyOrderCancelledEvent(event: OrderCancelledEvent): void {
    this._status = 'cancelled';
    this._cancelReason = event.reason;
  }
}
