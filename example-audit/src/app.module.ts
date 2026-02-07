import { Module } from '@nestjs/common';
import { Pool } from 'pg';
import { NestMediatorModule } from '@rolandsall24/nest-mediator';
import { OrderController } from './presentation/order/order.controller';
import { InternalsController } from './presentation/internals/internals.controller';
import {
  ORDER_PERSISTOR,
  CreateOrderHandler,
  CancelOrderHandler,
  GetOrderHandler,
  GetOrdersHandler,
} from './application/order';
import {
  ReserveInventoryHandler,
  ProcessPaymentHandler,
  SendConfirmationEmailHandler,
  ReleaseInventoryHandler,
  RefundPaymentHandler,
  SendCancellationEmailHandler,
  HandleInventoryReleasedHandler,
  HandlePaymentRefundedHandler,
} from './application/event-handlers';
import {
  AuditLoggingService,
  AuditLoggingBehavior,
  CachingBehavior,
  RetryBehavior,
} from './application/behaviors';
import { PostgresOrderPersistenceAdapter } from './infrastructure/persistence/order';

const databaseUrl = process.env.DATABASE_URL;

/**
 * AUDIT MODE EXAMPLE
 *
 * Key differences from Source mode:
 * - Orders stored in PostgreSQL via OrderPersistor (source of truth)
 * - Events logged to audit_events for audit trail only
 * - NO @DomainEvent decorator - events are simple
 * - NO aggregates - state comes from the orders table
 * - Clean architecture: port (IOrderPersistor) + adapter (PostgresOrderPersistenceAdapter)
 */
@Module({
  imports: [
    NestMediatorModule.forRoot({
      enableLogging: true,
      enableValidation: true,
      enableExceptionHandling: true,
      enablePerformanceTracking: true,
      performanceThresholdMs: 100,
      eventStore: databaseUrl
        ? {
            type: 'postgres',
            url: databaseUrl,
            mode: 'audit',
            tableName: 'audit_events',
          }
        : undefined,
    }),
  ],
  controllers: [OrderController, InternalsController],
  providers: [
    // Database pool (shared between OrderPersistor and event store)
    {
      provide: 'DATABASE_POOL',
      useFactory: () => new Pool({ connectionString: databaseUrl }),
    },

    // Port → Adapter binding
    {
      provide: ORDER_PERSISTOR,
      useClass: PostgresOrderPersistenceAdapter,
    },

    // Command handlers
    CreateOrderHandler,
    CancelOrderHandler,

    // Query handlers
    GetOrderHandler,
    GetOrdersHandler,

    // Custom behavior services
    AuditLoggingService,

    // Custom behaviors
    AuditLoggingBehavior,
    CachingBehavior,
    RetryBehavior,

    // Order placed event handlers (side effects)
    ReserveInventoryHandler,
    ProcessPaymentHandler,
    SendConfirmationEmailHandler,

    // Order cancelled event handlers (side effects)
    ReleaseInventoryHandler,
    RefundPaymentHandler,
    SendCancellationEmailHandler,

    // Compensating event handlers
    HandleInventoryReleasedHandler,
    HandlePaymentRefundedHandler,
  ],
})
export class AppModule {}
