import { Module } from '@nestjs/common';
import { NestMediatorModule } from '@rolandsall24/nest-mediator';
import { OrderController } from './presentation/order/order.controller';
import { InternalsController } from './presentation/internals/internals.controller';
import {
  PlaceOrderHandler,
  CancelOrderHandler,
  GetOrderHandler,
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
import { OrderAggregateRepository } from './infrastructure/persistence/order';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is required for source mode. ' +
    'Run: docker compose up -d && DATABASE_URL=postgres://postgres:postgres@localhost:5434/source_example npm run start:dev',
  );
}

/**
 * SOURCE MODE EXAMPLE
 *
 * Key differences from Audit mode:
 * - NO order table - events ARE the data
 * - Events use @DomainEvent decorator for aggregate tracking
 * - OrderAggregate rebuilds state by replaying events
 * - Query /orders/:id to get current state (rebuilt from events)
 * - OrderAggregateRepository uses @ForAggregate for zero-boilerplate setup
 */
@Module({
  imports: [
    NestMediatorModule.forRoot({
      enableLogging: true,
      enableValidation: true,
      enableExceptionHandling: true,
      enablePerformanceTracking: true,
      performanceThresholdMs: 100,
      eventStore: {
        type: 'postgres',
        url: databaseUrl,
        mode: 'source',
        tableName: 'domain_events',
      },
    }),
  ],
  controllers: [OrderController, InternalsController],
  providers: [
    // Aggregate repository (zero-boilerplate via @ForAggregate)
    OrderAggregateRepository,

    // Command handlers
    PlaceOrderHandler,
    CancelOrderHandler,

    // Query handlers
    GetOrderHandler,

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
