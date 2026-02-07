import { Order } from '../../domain/entities';

/**
 * Port - OrderPersistor interface.
 * The application layer depends on this abstraction, not on any concrete implementation.
 */
export const ORDER_PERSISTOR = Symbol('ORDER_PERSISTOR');

export interface IOrderPersistor {
  save(order: Order): Promise<void>;
  findById(orderId: string): Promise<Order | null>;
  findAll(): Promise<Order[]>;
  updateStatus(orderId: string, status: 'cancelled', reason: string): Promise<boolean>;
}
