import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
// Import from local library (linked via package.json)
import { NestMediatorModule } from '@rolandsall24/nest-mediator';

// Command handlers
import { CreateUserHandler } from './users/commands/create-user.handler';
import { DeleteUserHandler } from './users/commands/delete-user.handler';
import { ProcessPaymentHandler } from './users/commands/process-payment.handler';

// Query handlers
import { GetUserHandler } from './users/queries/get-user.handler';

// Custom behaviors and services
import {
  AuditLoggingService,
  AuditLoggingBehavior,
  CachingBehavior,
  RetryBehavior,
  AuthorizationService,
  AuthorizationBehavior,
  CreateUserValidationBehavior,
} from './behaviors';

@Module({
  imports: [
    // Configure with pipeline behaviors enabled
    NestMediatorModule.forRoot({
      enableLogging: true, // Log all requests with timing
      enableValidation: true, // Validate requests with class-validator
      enableExceptionHandling: true, // Centralized exception logging
      enablePerformanceTracking: true, // Warn on slow requests
      performanceThresholdMs: 100, // 100ms threshold for demo
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,

    // Command handlers
    CreateUserHandler,
    DeleteUserHandler,
    ProcessPaymentHandler,

    // Query handlers
    GetUserHandler,

    // Custom behavior services (injected into behaviors)
    AuditLoggingService,
    AuthorizationService,

    // Custom behaviors - auto-discovered via @PipelineBehavior decorator
    // Execution order (by priority, lower = first):
    // -100: ExceptionHandlingBehavior (built-in)
    //  -50: RetryBehavior (custom) - wraps everything for retry logic
    //    0: LoggingBehavior (built-in)
    //    5: CachingBehavior (custom, query-only)
    //   10: PerformanceBehavior (built-in)
    //   25: AuthorizationBehavior (custom)
    //   50: AuditLoggingBehavior (custom, command-only)
    //   95: CreateUserValidationBehavior (custom, CreateUserCommand-only) <-- NEW: Type-specific!
    //  100: ValidationBehavior (built-in)
    AuditLoggingBehavior,
    CachingBehavior,
    RetryBehavior,
    AuthorizationBehavior,
    CreateUserValidationBehavior,
  ],
})
export class AppModule {}
