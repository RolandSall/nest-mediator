import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
// Import from local library (linked via package.json)
import { NestMediatorModule } from '@rolandsall24/nest-mediator';
import { CreateUserHandler } from './users/commands/create-user.handler';
import { GetUserHandler } from './users/queries/get-user.handler';

@Module({
  imports: [
    // Configure with pipeline behaviors enabled
    NestMediatorModule.forRootAsync({
      enableLogging: true, // Log all requests with timing
      enableValidation: true, // Validate requests with class-validator
      enableExceptionHandling: true, // Centralized exception logging
      enablePerformanceTracking: true, // Warn on slow requests
      performanceThresholdMs: 100, // 100ms threshold for demo
    }),
  ],
  controllers: [AppController],
  providers: [AppService, CreateUserHandler, GetUserHandler],
})
export class AppModule {}
