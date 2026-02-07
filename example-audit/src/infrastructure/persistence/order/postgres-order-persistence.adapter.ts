import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';
import { IOrderPersistor } from '../../../application/order/order-persistor.port';
import { Order } from '../../../domain/entities';
import { OrderMapper } from './order.entity';

@Injectable()
export class PostgresOrderPersistenceAdapter implements IOrderPersistor, OnModuleInit {
  private readonly logger = new Logger(PostgresOrderPersistenceAdapter.name);

  constructor(@Inject('DATABASE_POOL') private readonly pool: Pool) {}

  async onModuleInit(): Promise<void> {
    await this.ensureTable();
  }

  async save(order: Order): Promise<void> {
    const entity = OrderMapper.toEntity(order);
    await this.pool.query(
      `INSERT INTO orders (order_id, customer_id, items, total, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (order_id) DO UPDATE SET
         status = EXCLUDED.status,
         cancelled_at = EXCLUDED.cancelled_at,
         cancel_reason = EXCLUDED.cancel_reason`,
      [
        entity.order_id,
        entity.customer_id,
        JSON.stringify(entity.items),
        entity.total,
        entity.status,
        entity.created_at,
      ],
    );
    this.logger.log(`Order ${order.orderId} saved to PostgreSQL`);
  }

  async findById(orderId: string): Promise<Order | null> {
    const result = await this.pool.query(
      'SELECT * FROM orders WHERE order_id = $1',
      [orderId],
    );
    if (result.rows.length === 0) return null;
    return OrderMapper.toDomain(result.rows[0]);
  }

  async findAll(): Promise<Order[]> {
    const result = await this.pool.query(
      'SELECT * FROM orders ORDER BY created_at DESC',
    );
    return result.rows.map(OrderMapper.toDomain);
  }

  async updateStatus(orderId: string, status: 'cancelled', reason: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE orders SET status = $1, cancelled_at = $2, cancel_reason = $3
       WHERE order_id = $4 AND status != 'cancelled'`,
      [status, new Date(), reason, orderId],
    );
    if (result.rowCount && result.rowCount > 0) {
      this.logger.log(`Order ${orderId} cancelled: ${reason}`);
      return true;
    }
    return false;
  }

  private async ensureTable(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        order_id VARCHAR(255) PRIMARY KEY,
        customer_id VARCHAR(255) NOT NULL,
        items JSONB NOT NULL,
        total NUMERIC(10, 2) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'placed',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        cancelled_at TIMESTAMPTZ,
        cancel_reason TEXT
      )
    `);
    this.logger.log('Orders table ensured');
  }
}
