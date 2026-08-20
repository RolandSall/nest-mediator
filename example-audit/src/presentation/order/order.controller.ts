import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { MediatorBus } from '@nest-mediator/core';
import {
  CreateOrderCommand,
  CancelOrderCommand,
  GetOrderQuery,
  GetOrdersQuery,
} from '../../application/order';
import { CreateOrderApiRequest, CancelOrderApiRequest } from './create-order-api.request';

@Controller()
export class OrderController {
  constructor(private readonly mediator: MediatorBus) {}

  @Get()
  info() {
    return {
      mode: 'AUDIT',
      description: 'Orders stored in PostgreSQL, events logged to audit_events table',
      note: 'Query /orders for current state, /internals/audit for event log',
    };
  }

  @Post('orders')
  async createOrder(@Body() body: CreateOrderApiRequest) {
    // Command that RETURNS a value — the generated order id.
    const orderId = await this.mediator.send<string>(
      new CreateOrderCommand(body.customerId, body.items, body.total),
    );
    return { success: true, orderId, message: 'Order created successfully' };
  }

  @Post('orders/:id/cancel')
  async cancelOrder(@Param('id') orderId: string, @Body() body: CancelOrderApiRequest) {
    // Command that returns NOTHING — unchanged, still Promise<void>.
    await this.mediator.send(
      new CancelOrderCommand(orderId, body.reason),
    );
    return { success: true, message: `Order ${orderId} cancelled` };
  }

  @Get('orders')
  async getOrders() {
    return this.mediator.query(new GetOrdersQuery());
  }

  @Get('orders/:id')
  async getOrder(@Param('id') orderId: string) {
    const order = await this.mediator.query(new GetOrderQuery(orderId));
    return order ?? { error: 'Order not found' };
  }
}
