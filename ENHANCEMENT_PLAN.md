# nest-mediator Enhancement Plan

## Current State Summary

**nest-mediator** is a lightweight CQRS mediator pattern implementation for NestJS. It currently provides:

### Existing Features
| Feature | Status | Description |
|---------|--------|-------------|
| Commands | ✅ | `ICommand` interface + `@CommandHandler` decorator |
| Queries | ✅ | `IQuery` interface + `@QueryHandler` decorator |
| Type-safe handlers | ✅ | Generic interfaces with type constraints |
| Auto-discovery | ✅ | Automatic handler registration via decorators |
| DI Integration | ✅ | Full NestJS dependency injection support |
| Global module | ✅ | `NestMediatorModule.forRoot()` with global scope |

### Architecture
```
Controller → MediatorBus.send(command) → CommandHandler.execute()
Controller → MediatorBus.query(query) → QueryHandler.execute() → Result
```

---

## MediatR Features Comparison

### What MediatR Has That nest-mediator Lacks

| MediatR Feature | nest-mediator Status | Priority |
|-----------------|---------------------|----------|
| **Pipeline Behaviors** | ❌ Missing | 🔴 Critical |
| **Notifications (Publish/Subscribe)** | ❌ Missing | 🔴 Critical |
| **Pre/Post Processors** | ❌ Missing | 🟡 High |
| **Exception Handlers** | ❌ Missing | 🟡 High |
| **Request/Response Logging** | ❌ Missing | 🟡 High |
| **Validation Pipeline** | ❌ Missing | 🔴 Critical |
| **Caching Behavior** | ❌ Missing | 🟢 Medium |
| **Performance Tracking** | ❌ Missing | 🟢 Medium |
| **Unit of Work Pattern** | ❌ Missing | 🟢 Medium |
| **Parallel Notification Publishing** | ❌ Missing | 🟢 Medium |
| **Stream Requests** | ❌ Missing | 🟢 Medium |

---

## Enhancement Plan

### Phase 1: Pipeline Behaviors (Critical)

Pipeline behaviors are MediatR's most powerful feature - they allow middleware-like processing around handlers.

#### 1.1 Create `IPipelineBehavior` Interface

```typescript
// src/lib/interfaces/pipeline-behavior.interface.ts
export interface IPipelineBehavior<TRequest, TResponse> {
  handle(
    request: TRequest,
    next: () => Promise<TResponse>
  ): Promise<TResponse>;
}
```

#### 1.2 Create `@PipelineBehavior` Decorator

```typescript
// src/lib/decorators/pipeline-behavior.decorator.ts
export const PIPELINE_BEHAVIOR_METADATA = 'PIPELINE_BEHAVIOR_METADATA';

export interface PipelineBehaviorOptions {
  priority?: number;  // Execution order (lower = first)
  scope?: 'command' | 'query' | 'all';
}

export const PipelineBehavior = (options?: PipelineBehaviorOptions): ClassDecorator => {
  return SetMetadata(PIPELINE_BEHAVIOR_METADATA, options ?? { priority: 0, scope: 'all' });
};
```

#### 1.3 Update `MediatorBus` to Support Pipeline

```typescript
// Enhanced MediatorBus with pipeline support
private pipelineBehaviors: Type<IPipelineBehavior<any, any>>[] = [];

async send<TCommand extends ICommand>(command: TCommand): Promise<void> {
  const handler = this.getCommandHandler(command);
  const pipeline = this.buildPipeline(command, () => handler.execute(command));
  return pipeline();
}

private buildPipeline<TRequest, TResponse>(
  request: TRequest,
  handler: () => Promise<TResponse>
): () => Promise<TResponse> {
  return this.pipelineBehaviors
    .filter(b => this.matchesScope(b, request))
    .sort((a, b) => this.getPriority(a) - this.getPriority(b))
    .reduceRight(
      (next, behaviorType) => async () => {
        const behavior = this.moduleRef.get(behaviorType, { strict: false });
        return behavior.handle(request, next);
      },
      handler
    );
}
```

#### 1.4 Built-in Behaviors to Implement

**Validation Behavior:**
```typescript
@Injectable()
@PipelineBehavior({ priority: 100, scope: 'all' })
export class ValidationBehavior<TRequest, TResponse>
  implements IPipelineBehavior<TRequest, TResponse> {

  constructor(private validators: IValidator<TRequest>[]) {}

  async handle(request: TRequest, next: () => Promise<TResponse>): Promise<TResponse> {
    const errors = await this.validate(request);
    if (errors.length > 0) {
      throw new ValidationException(errors);
    }
    return next();
  }
}
```

**Logging Behavior:**
```typescript
@Injectable()
@PipelineBehavior({ priority: 0, scope: 'all' })
export class LoggingBehavior<TRequest, TResponse>
  implements IPipelineBehavior<TRequest, TResponse> {

  private readonly logger = new Logger('MediatorBus');

  async handle(request: TRequest, next: () => Promise<TResponse>): Promise<TResponse> {
    const requestName = request.constructor.name;
    this.logger.log(`Handling ${requestName}`);
    const start = Date.now();

    try {
      const response = await next();
      this.logger.log(`Handled ${requestName} in ${Date.now() - start}ms`);
      return response;
    } catch (error) {
      this.logger.error(`Failed ${requestName}: ${error.message}`);
      throw error;
    }
  }
}
```

**Exception Handling Behavior:**
```typescript
@Injectable()
@PipelineBehavior({ priority: -100, scope: 'all' })
export class ExceptionHandlingBehavior<TRequest, TResponse>
  implements IPipelineBehavior<TRequest, TResponse> {

  async handle(request: TRequest, next: () => Promise<TResponse>): Promise<TResponse> {
    try {
      return await next();
    } catch (error) {
      // Transform or log exceptions
      throw this.transformException(error);
    }
  }
}
```

---

### Phase 2: Notifications (Publish/Subscribe)

Notifications allow broadcasting events to multiple handlers.

#### 2.1 Create Notification Interfaces

```typescript
// src/lib/interfaces/notification.interface.ts
export interface INotification {}

// src/lib/interfaces/notification-handler.interface.ts
export interface INotificationHandler<TNotification extends INotification> {
  handle(notification: TNotification): Promise<void>;
}
```

#### 2.2 Create `@NotificationHandler` Decorator

```typescript
export const NOTIFICATION_HANDLER_METADATA = 'NOTIFICATION_HANDLER_METADATA';

export const NotificationHandler = (
  notification: new (...args: any[]) => INotification
): ClassDecorator => {
  return SetMetadata(NOTIFICATION_HANDLER_METADATA, notification);
};
```

#### 2.3 Add `publish()` Method to MediatorBus

```typescript
// One-to-many: publishes to all registered handlers
async publish<TNotification extends INotification>(
  notification: TNotification
): Promise<void> {
  const handlers = this.getNotificationHandlers(notification);
  await Promise.all(handlers.map(h => h.handle(notification)));
}

// Sequential publishing option
async publishSequential<TNotification extends INotification>(
  notification: TNotification
): Promise<void> {
  const handlers = this.getNotificationHandlers(notification);
  for (const handler of handlers) {
    await handler.handle(notification);
  }
}
```

---

### Phase 3: Pre/Post Processors

#### 3.1 Create Processor Interfaces

```typescript
// Pre-processor runs before handler
export interface IRequestPreProcessor<TRequest> {
  process(request: TRequest): Promise<void>;
}

// Post-processor runs after handler
export interface IRequestPostProcessor<TRequest, TResponse> {
  process(request: TRequest, response: TResponse): Promise<void>;
}
```

#### 3.2 Create Decorators

```typescript
export const RequestPreProcessor = (request: Type): ClassDecorator =>
  SetMetadata(PRE_PROCESSOR_METADATA, request);

export const RequestPostProcessor = (request: Type): ClassDecorator =>
  SetMetadata(POST_PROCESSOR_METADATA, request);
```

---

### Phase 4: Validation Integration

#### 4.1 Create Validator Interface

```typescript
export interface IValidator<TRequest> {
  validate(request: TRequest): Promise<ValidationResult>;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  property: string;
  message: string;
  code?: string;
}
```

#### 4.2 Create `@Validator` Decorator

```typescript
export const Validator = (request: Type): ClassDecorator =>
  SetMetadata(VALIDATOR_METADATA, request);
```

#### 4.3 class-validator Integration

```typescript
// Optional integration with class-validator
@Injectable()
export class ClassValidatorBehavior<TRequest, TResponse>
  implements IPipelineBehavior<TRequest, TResponse> {

  async handle(request: TRequest, next: () => Promise<TResponse>): Promise<TResponse> {
    const errors = await validate(request);
    if (errors.length > 0) {
      throw new ValidationException(errors);
    }
    return next();
  }
}
```

---

### Phase 5: Advanced Features

#### 5.1 Caching Behavior

```typescript
export interface ICacheableRequest {
  getCacheKey(): string;
  getCacheTtl?(): number;
}

@Injectable()
@PipelineBehavior({ priority: 50, scope: 'query' })
export class CachingBehavior<TRequest extends ICacheableRequest, TResponse>
  implements IPipelineBehavior<TRequest, TResponse> {

  constructor(private cacheManager: Cache) {}

  async handle(request: TRequest, next: () => Promise<TResponse>): Promise<TResponse> {
    const cacheKey = request.getCacheKey();
    const cached = await this.cacheManager.get<TResponse>(cacheKey);

    if (cached) return cached;

    const response = await next();
    await this.cacheManager.set(cacheKey, response, request.getCacheTtl?.() ?? 300);
    return response;
  }
}
```

#### 5.2 Performance Tracking

```typescript
@Injectable()
@PipelineBehavior({ priority: 10, scope: 'all' })
export class PerformanceBehavior<TRequest, TResponse>
  implements IPipelineBehavior<TRequest, TResponse> {

  private readonly logger = new Logger('Performance');
  private readonly threshold = 500; // ms

  async handle(request: TRequest, next: () => Promise<TResponse>): Promise<TResponse> {
    const start = performance.now();
    const response = await next();
    const elapsed = performance.now() - start;

    if (elapsed > this.threshold) {
      this.logger.warn(`Slow request: ${request.constructor.name} took ${elapsed}ms`);
    }

    return response;
  }
}
```

#### 5.3 Unit of Work / Transaction Behavior

```typescript
@Injectable()
@PipelineBehavior({ priority: 200, scope: 'command' })
export class TransactionBehavior<TRequest, TResponse>
  implements IPipelineBehavior<TRequest, TResponse> {

  constructor(private dataSource: DataSource) {}

  async handle(request: TRequest, next: () => Promise<TResponse>): Promise<TResponse> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.startTransaction();

    try {
      const response = await next();
      await queryRunner.commitTransaction();
      return response;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
```

---

### Phase 6: Stream Requests (Async Iterables)

```typescript
export interface IStreamRequest<TResponse> {}

export interface IStreamRequestHandler<TRequest extends IStreamRequest<TResponse>, TResponse> {
  handle(request: TRequest): AsyncIterable<TResponse>;
}

// MediatorBus addition
async *createStream<TRequest extends IStreamRequest<TResponse>, TResponse>(
  request: TRequest
): AsyncIterable<TResponse> {
  const handler = this.getStreamHandler(request);
  yield* handler.handle(request);
}
```

---

## Implementation Priority

### Immediate (v0.5.0)
1. ✅ Pipeline Behaviors with `IPipelineBehavior`
2. ✅ Built-in `LoggingBehavior`
3. ✅ Built-in `ValidationBehavior` (with class-validator)
4. ✅ `@PipelineBehavior` decorator with priority

### Short-term (v0.6.0)
5. ✅ Notifications with `INotification` and `publish()`
6. ✅ Pre/Post Processors
7. ✅ Exception Handling Behavior

### Medium-term (v0.7.0)
8. ✅ Caching Behavior
9. ✅ Performance Tracking Behavior
10. ✅ Transaction/Unit of Work Behavior

### Long-term (v1.0.0)
11. ✅ Stream Requests
12. ✅ Parallel Notification Publishing strategies
13. ✅ Complete documentation and examples

---

## File Structure After Enhancement

```
src/lib/
├── interfaces/
│   ├── command.interface.ts
│   ├── command-handler.interface.ts
│   ├── query.interface.ts
│   ├── query-handler.interface.ts
│   ├── notification.interface.ts           # NEW
│   ├── notification-handler.interface.ts   # NEW
│   ├── pipeline-behavior.interface.ts      # NEW
│   ├── validator.interface.ts              # NEW
│   ├── pre-processor.interface.ts          # NEW
│   ├── post-processor.interface.ts         # NEW
│   └── index.ts
├── decorators/
│   ├── command-handler.decorator.ts
│   ├── query-handler.decorator.ts
│   ├── notification-handler.decorator.ts   # NEW
│   ├── pipeline-behavior.decorator.ts      # NEW
│   ├── validator.decorator.ts              # NEW
│   └── index.ts
├── behaviors/                               # NEW
│   ├── logging.behavior.ts
│   ├── validation.behavior.ts
│   ├── exception-handling.behavior.ts
│   ├── caching.behavior.ts
│   ├── performance.behavior.ts
│   ├── transaction.behavior.ts
│   └── index.ts
├── exceptions/                              # NEW
│   ├── validation.exception.ts
│   ├── handler-not-found.exception.ts
│   └── index.ts
├── services/
│   ├── mediator.bus.ts                     # ENHANCED
│   └── index.ts
└── nest-mediator.module.ts                 # ENHANCED
```

---

## API Design After Enhancement

```typescript
// Module setup with behaviors
NestMediatorModule.forRoot({
  behaviors: [
    LoggingBehavior,
    ValidationBehavior,
    PerformanceBehavior,
  ],
  enableClassValidator: true,
  enableLogging: true,
})

// Usage
@Controller('users')
export class UserController {
  constructor(private mediator: MediatorBus) {}

  @Post()
  async create(@Body() dto: CreateUserDto) {
    // Pipeline: Logging → Validation → Handler → Logging
    await this.mediator.send(new CreateUserCommand(dto));

    // Publish notification to all subscribers
    await this.mediator.publish(new UserCreatedNotification(user.id));
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    // Pipeline: Logging → Cache Check → Handler → Cache Store → Logging
    return this.mediator.query(new GetUserQuery(id));
  }
}
```

---

## Sources

- [MediatR Pipeline Behaviors - Code with Mukesh](https://codewithmukesh.com/blog/mediatr-pipeline-behaviour/)
- [Validation with MediatR and FluentValidation](https://codewithmukesh.com/blog/validation-with-mediatr-pipeline-behavior-and-fluentvalidation/)
- [CQRS Validation Pipeline - Code Maze](https://code-maze.com/cqrs-mediatr-fluentvalidation/)
- [MediatR Notifications - Milan Jovanovic](https://www.milanjovanovic.tech/blog/how-to-publish-mediatr-notifications-in-parallel)
- [MediatR with Notifications - Medium](https://medium.com/@mlkpatel0/net-core-mediatr-with-notification-publish-and-behaviors-469d1433607a)
- [Cross-cutting Concerns with MediatR](https://lurumad.github.io/cross-cutting-concerns-in-asp-net-core-with-meaditr)