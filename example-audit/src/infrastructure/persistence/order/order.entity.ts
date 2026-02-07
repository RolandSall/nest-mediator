import { Order } from '../../../domain/entities';

/**
 * Infrastructure entity - represents the database row shape.
 */
export interface OrderEntity {
  order_id: string;
  customer_id: string;
  items: { productId: string; quantity: number }[];
  total: number;
  status: 'placed' | 'cancelled';
  created_at: Date;
  cancelled_at: Date | null;
  cancel_reason: string | null;
}

/**
 * Maps between domain Order and infrastructure OrderEntity.
 */
export class OrderMapper {
  static toDomain(entity: OrderEntity): Order {
    return {
      orderId: entity.order_id,
      customerId: entity.customer_id,
      items: entity.items,
      total: Number(entity.total),
      status: entity.status,
      createdAt: entity.created_at,
      cancelledAt: entity.cancelled_at ?? undefined,
      cancelReason: entity.cancel_reason ?? undefined,
    };
  }

  static toEntity(order: Order): OrderEntity {
    return {
      order_id: order.orderId,
      customer_id: order.customerId,
      items: order.items,
      total: order.total,
      status: order.status,
      created_at: order.createdAt,
      cancelled_at: order.cancelledAt ?? null,
      cancel_reason: order.cancelReason ?? null,
    };
  }
}
