# nest-mediator Example

This is an example NestJS application demonstrating the `@rolandsall24/nest-mediator` library with pipeline behaviors.

## Features Demonstrated

- **Commands**: `CreateUserCommand` with `CreateUserHandler`
- **Queries**: `GetUserQuery` with `GetUserHandler`
- **Pipeline Behaviors**: Logging, Validation, Exception Handling, Performance Tracking

## Setup

```bash
# From the example directory
cd example

# Install dependencies (links to local library)
npm install

# Start the development server
npm run start:dev
```

## Test Endpoints

### Create a User (Command)
```bash
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Test User", "email": "test@example.com"}'
```

### Get a User (Query)
```bash
# Get mock user (id: 1 or 2)
curl http://localhost:3000/users/1

# Get non-existent user
curl http://localhost:3000/users/999
```

## Expected Console Output

With pipeline behaviors enabled, you'll see output like:

```
[NestMediator] Registering command handler: CreateUserHandler for command: CreateUserCommand
[NestMediator] Registering query handler: GetUserHandler for query: GetUserQuery
[NestMediator] Registering pipeline behavior: ExceptionHandlingBehavior (priority: -100, scope: all)
[NestMediator] Registering pipeline behavior: LoggingBehavior (priority: 0, scope: all)
[NestMediator] Registering pipeline behavior: PerformanceBehavior (priority: 10, scope: all)
[NestMediator] Registering pipeline behavior: ValidationBehavior (priority: 100, scope: all)

[MediatorBus] Handling CreateUserCommand...
User created: {"id":"abc123","name":"Test User","email":"test@example.com"}
[MediatorBus] Handled CreateUserCommand successfully in 2ms

[MediatorBus] Handling GetUserQuery...
Query for user 1: Found
[MediatorBus] Handled GetUserQuery successfully in 1ms
```

## Configuration Options

Edit `app.module.ts` to test different behavior combinations:

```typescript
NestMediatorModule.forRootAsync({
  enableLogging: true,           // Log requests with timing
  enableValidation: true,        // Validate with class-validator
  enableExceptionHandling: true, // Centralized exception logging
  enablePerformanceTracking: true, // Slow request warnings
  performanceThresholdMs: 100,   // Threshold in ms
})
```
