/**
 * Domain model - the business representation of an Order.
 */
export interface Order {
  orderId: string;
  customerId: string;
  items: { productId: string; quantity: number }[];
  total: number;
  status: 'placed' | 'cancelled';
  createdAt: Date;
  cancelledAt?: Date;
  cancelReason?: string;
}
