# NestJS Mediator

A lightweight CQRS (Command Query Responsibility Segregation) mediator pattern implementation for NestJS applications.

## Features

- Clean separation between Commands and Queries
- Type-safe handlers with TypeScript
- Decorator-based handler registration
- Automatic handler discovery and registration
- **Pipeline Behaviors** for cross-cutting concerns (logging, validation, etc.)
- Built-in behaviors: Logging, Validation, Exception Handling, Performance Tracking
- Built on top of NestJS dependency injection
- Zero runtime dependencies beyond NestJS

## Installation

```bash
npm install @rolandsall24/nest-mediator
```

### TypeScript Configuration

This library requires TypeScript decorators to be enabled. Add the following to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

## Upgrading to v0.5.0

Version 0.5.0 introduces **Pipeline Behaviors** while maintaining backward compatibility. Existing code using `NestMediatorModule.forRoot()` will continue to work without changes.

### What's New

- Pipeline behaviors for cross-cutting concerns (logging, validation, etc.)
- Built-in behaviors: `LoggingBehavior`, `ValidationBehavior`, `ExceptionHandlingBehavior`, `PerformanceBehavior`
- New `forRootAsync()` method for enabling behaviors
- Custom `HandlerNotFoundException` for better error handling

### Breaking Change Notice

The `send()` and `query()` methods now throw `HandlerNotFoundException` instead of a generic `Error` when no handler is registered. This is **backward compatible** since `HandlerNotFoundException` extends `Error`, but you may want to update your error handling for more specific catches:

```typescript
// Before (still works)
try {
  await mediator.send(command);
} catch (error) {
  if (error instanceof Error) {
    console.log(error.message); // Works as before
  }
}

// After (optional - for more specific handling)
import { HandlerNotFoundException } from '@rolandsall24/nest-mediator';

try {
  await mediator.send(command);
} catch (error) {
  if (error instanceof HandlerNotFoundException) {
    console.log(`No handler for: ${error.requestName}`);
  }
}
```

### No Migration Required

If you're using `NestMediatorModule.forRoot()`, no changes are needed. Pipeline behaviors are **opt-in** via `forRootAsync()`:

```typescript
// Existing code - works exactly as before (no behaviors)
NestMediatorModule.forRoot()

// New - opt-in to behaviors
NestMediatorModule.forRootAsync({
  enableLogging: true,
  enableValidation: true,
})
```

## Quick Start

### 1. Import the Module

Import `NestMediatorModule` in your application module:

```typescript
import { Module } from '@nestjs/common';
import { NestMediatorModule } from '@rolandsall24/nest-mediator';
import { CreateUserCommandHandler } from './handlers/create-user.handler';
import { GetUserQueryHandler } from './handlers/get-user-query.handler';

@Module({
  imports: [
    // Basic setup
    NestMediatorModule.forRoot(),
  ],
  providers: [
    // Add your handlers to the providers array
    // They will be automatically discovered by the mediator
    CreateUserCommandHandler,
    GetUserQueryHandler,
  ],
})
export class AppModule {}
```

Or with built-in pipeline behaviors enabled:

```typescript
@Module({
  imports: [
    NestMediatorModule.forRootAsync({
      enableLogging: true,           // Log request handling with timing
      enableValidation: true,        // Validate requests with class-validator
      enableExceptionHandling: true, // Centralized exception logging
    }),
  ],
  providers: [
    CreateUserCommandHandler,
    GetUserQueryHandler,
  ],
})
export class AppModule {}
```

**How it works**: The module uses NestJS's `DiscoveryService` to automatically discover and register all providers decorated with `@CommandHandler`, `@QueryHandler`, or `@PipelineBehavior`. Simply add your handlers to the module's `providers` array and they will be automatically registered with the mediator!

## Usage

### Commands

Commands are used for operations that change state (create, update, delete).

#### 1. Define a Command

```typescript
import { ICommand } from '@rolandsall24/nest-mediator';

export class CreateUserCommand implements ICommand {
  constructor(
    public readonly email: string,
    public readonly name: string,
    public readonly age: number
  ) {}
}
```

#### 2. Create a Command Handler

```typescript
import { Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@rolandsall24/nest-mediator';
import { CreateUserCommand } from '../commands/create-user.command';

@Injectable()
@CommandHandler(CreateUserCommand)
export class CreateUserCommandHandler implements ICommandHandler<CreateUserCommand> {
  constructor(
    // Inject your services here
    // private readonly userRepository: UserRepository,
  ) {}

  async execute(command: CreateUserCommand): Promise<void> {
    // Business logic here
    console.log(`Creating user: ${command.email}`);

    // Example: Save to database
    // await this.userRepository.save({
    //   email: command.email,
    //   name: command.name,
    //   age: command.age,
    // });
  }
}
```

#### 3. Send a Command from Controller

```typescript
import { Controller, Post, Body } from '@nestjs/common';
import { MediatorBus } from '@rolandsall24/nest-mediator';
import { CreateUserCommand } from './commands/create-user.command';

@Controller('users')
export class UserController {
  constructor(private readonly mediator: MediatorBus) {}

  @Post()
  async create(@Body() body: { email: string; name: string; age: number }): Promise<void> {
    const command = new CreateUserCommand(
      body.email,
      body.name,
      body.age
    );

    await this.mediator.send(command);
  }
}
```

### Queries

Queries are used for operations that read data without changing state.

#### 1. Define a Query

```typescript
import { IQuery } from '@rolandsall24/nest-mediator';

export class GetUserByIdQuery implements IQuery {
  constructor(public readonly userId: string) {}
}
```

#### 2. Define a Query Result Type

```typescript
export interface UserDto {
  id: string;
  email: string;
  name: string;
  age: number;
  createdAt: Date;
}
```

#### 3. Create a Query Handler

```typescript
import { Injectable } from '@nestjs/common';
import { QueryHandler, IQueryHandler } from '@rolandsall24/nest-mediator';
import { GetUserByIdQuery } from '../queries/get-user-by-id.query';
import { UserDto } from '../dtos/user.dto';

@Injectable()
@QueryHandler(GetUserByIdQuery)
export class GetUserByIdQueryHandler implements IQueryHandler<GetUserByIdQuery, UserDto> {
  constructor(
    // Inject your services here
    // private readonly userRepository: UserRepository,
  ) {}

  async execute(query: GetUserByIdQuery): Promise<UserDto> {
    // Business logic here
    console.log(`Fetching user with ID: ${query.userId}`);

    // Example: Fetch from database
    // const user = await this.userRepository.findById(query.userId);

    // Return mock data for demonstration
    return {
      id: query.userId,
      email: 'john.doe@example.com',
      name: 'John Doe',
      age: 30,
      createdAt: new Date(),
    };
  }
}
```

#### 4. Execute a Query from Controller

```typescript
import { Controller, Get, Param } from '@nestjs/common';
import { MediatorBus } from '@rolandsall24/nest-mediator';
import { GetUserByIdQuery } from './queries/get-user-by-id.query';
import { UserDto } from './dtos/user.dto';

@Controller('users')
export class UserController {
  constructor(private readonly mediator: MediatorBus) {}

  @Get(':id')
  async getById(@Param('id') id: string): Promise<UserDto> {
    const query = new GetUserByIdQuery(id);
    const user = await this.mediator.query<GetUserByIdQuery, UserDto>(query);
    return user;
  }
}
```

## Complete Example

Here's a complete example following Domain-Driven Design principles with proper separation of concerns:

### Project Structure

```
src/
├── domain/
│   ├── entities/
│   │   ├── user.ts
│   │   └── index.ts
│   └── exceptions/
│       ├── domain.exception.ts
│       ├── user-not-found.exception.ts
│       └── index.ts
├── application/
│   └── user/
│       ├── create-user.command.ts
│       ├── create-user.handler.ts
│       ├── get-user.query.ts
│       ├── get-user.handler.ts
│       └── user-persistor.port.ts
├── infrastructure/
│   └── persistence/
│       └── user/
│           └── user-persistence.adapter.ts
├── presentation/
│   └── user/
│       ├── create-user-api.request.ts
│       ├── user-api.response.ts
│       └── user.controller.ts
└── app.module.ts
```

### Domain Layer

#### domain/entities/user.ts

```typescript
export class User {
  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly name: string,
    public readonly age: number,
    public readonly createdAt: Date
  ) {}

  static create(params: {
    id: string;
    email: string;
    name: string;
    age: number;
  }): User {
    const now = new Date();
    return new User(
      params.id,
      params.email,
      params.name,
      params.age,
      now
    );
  }
}
```

#### domain/exceptions/domain.exception.ts

```typescript
export class DomainException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}
```

#### domain/exceptions/user-not-found.exception.ts

```typescript
import { DomainException } from './domain.exception';

export class UserNotFoundException extends DomainException {
  constructor(userId: string) {
    super(`User with id ${userId} not found`);
  }
}
```

### Application Layer

#### application/user/create-user.command.ts

```typescript
import { ICommand } from '@rolandsall24/nest-mediator';

export class CreateUserCommand implements ICommand {
  constructor(
    public readonly email: string,
    public readonly name: string,
    public readonly age: number
  ) {}
}
```

#### application/user/user-persistor.port.ts

```typescript
import { User } from '../../domain/entities/user';

export interface UserPersistor {
  save(user: User): Promise<User>;
  findById(id: string): Promise<User | null>;
}

export const USER_PERSISTOR = Symbol('USER_PERSISTOR');
```

#### application/user/create-user.handler.ts

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@rolandsall24/nest-mediator';
import { randomUUID } from 'crypto';
import { CreateUserCommand } from './create-user.command';
import { User } from '../../domain/entities/user';
import { UserPersistor, USER_PERSISTOR } from './user-persistor.port';

@Injectable()
@CommandHandler(CreateUserCommand)
export class CreateUserCommandHandler implements ICommandHandler<CreateUserCommand> {
  constructor(
    @Inject(USER_PERSISTOR)
    private readonly userPersistor: UserPersistor
  ) {}

  async execute(command: CreateUserCommand): Promise<void> {
    const id = randomUUID();

    const user = User.create({
      id,
      email: command.email,
      name: command.name,
      age: command.age,
    });

    await this.userPersistor.save(user);
  }
}
```

#### application/user/get-user.query.ts

```typescript
import { IQuery } from '@rolandsall24/nest-mediator';

export class GetUserQuery implements IQuery {
  constructor(public readonly id: string) {}
}
```

#### application/user/get-user.handler.ts

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { QueryHandler, IQueryHandler } from '@rolandsall24/nest-mediator';
import { GetUserQuery } from './get-user.query';
import { User } from '../../domain/entities/user';
import { UserNotFoundException } from '../../domain/exceptions/user-not-found.exception';
import { UserPersistor, USER_PERSISTOR } from './user-persistor.port';

@Injectable()
@QueryHandler(GetUserQuery)
export class GetUserQueryHandler implements IQueryHandler<GetUserQuery, User> {
  constructor(
    @Inject(USER_PERSISTOR)
    private readonly userPersistor: UserPersistor
  ) {}

  async execute(query: GetUserQuery): Promise<User> {
    const user = await this.userPersistor.findById(query.id);

    if (!user) {
      throw new UserNotFoundException(query.id);
    }

    return user;
  }
}
```

### Infrastructure Layer

#### infrastructure/persistence/user/user-persistence.adapter.ts

```typescript
import { Injectable } from '@nestjs/common';
import { UserPersistor } from '../../../application/user/user-persistor.port';
import { User } from '../../../domain/entities/user';

@Injectable()
export class UserPersistenceAdapter implements UserPersistor {
  // In-memory storage for demonstration
  private users: Map<string, User> = new Map();

  async save(user: User): Promise<User> {
    this.users.set(user.id, user);
    return user;
  }

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }
}
```

### Presentation Layer

#### presentation/user/create-user-api.request.ts

```typescript
export class CreateUserApiRequest {
  email: string;
  name: string;
  age: number;
}
```

#### presentation/user/user-api.response.ts

```typescript
export class UserApiResponse {
  id: string;
  email: string;
  name: string;
  age: number;
  createdAt: Date;
}
```

#### presentation/user/user.controller.ts

```typescript
import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { MediatorBus } from '@rolandsall24/nest-mediator';
import { CreateUserCommand } from '../../application/user/create-user.command';
import { GetUserQuery } from '../../application/user/get-user.query';
import { CreateUserApiRequest } from './create-user-api.request';
import { UserApiResponse } from './user-api.response';

@Controller('users')
export class UserController {
  constructor(private readonly mediator: MediatorBus) {}

  @Post()
  async create(@Body() request: CreateUserApiRequest): Promise<void> {
    const command = new CreateUserCommand(
      request.email,
      request.name,
      request.age
    );

    await this.mediator.send(command);
  }

  @Get(':id')
  async getById(@Param('id') id: string): Promise<UserApiResponse> {
    const query = new GetUserQuery(id);
    const user = await this.mediator.query(query);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      age: user.age,
      createdAt: user.createdAt,
    };
  }
}
```

### Module Configuration

#### app.module.ts

```typescript
import { Module } from '@nestjs/common';
import { NestMediatorModule } from '@rolandsall24/nest-mediator';
import { UserController } from './presentation/user/user.controller';
import { CreateUserCommandHandler } from './application/user/create-user.handler';
import { GetUserQueryHandler } from './application/user/get-user.handler';
import { USER_PERSISTOR } from './application/user/user-persistor.port';
import { UserPersistenceAdapter } from './infrastructure/persistence/user/user-persistence.adapter';

@Module({
  imports: [
    // Enable pipeline behaviors for logging, validation, and error handling
    NestMediatorModule.forRootAsync({
      enableLogging: true,
      enableValidation: true,
      enableExceptionHandling: true,
    }),
  ],
  controllers: [UserController],
  providers: [
    // Infrastructure
    {
      provide: USER_PERSISTOR,
      useClass: UserPersistenceAdapter,
    },
    // Handlers - automatically discovered and registered by the mediator
    CreateUserCommandHandler,
    GetUserQueryHandler,
  ],
})
export class AppModule {}
```

### Key Benefits

1. **Domain Layer**: Pure business logic, framework-agnostic
   - Entities contain business rules and invariants
   - Domain exceptions represent business errors

2. **Application Layer**: Use cases and business workflows
   - Commands/Queries define application operations
   - Handlers orchestrate domain objects and ports
   - Ports (interfaces) define contracts for infrastructure

3. **Infrastructure Layer**: Technical implementations
   - Adapters implement port interfaces
   - Database, external services, file systems, etc.

4. **Presentation Layer**: API interface
   - Controllers handle HTTP concerns
   - DTOs for API request/response
   - No business logic

This separation enables:
- Easy testing (mock ports/adapters)
- Technology independence (swap databases/frameworks)
- Clear boundaries and responsibilities
- Scalable architecture for growing applications

## API Reference

### Interfaces

#### `ICommand`

Marker interface for commands.

```typescript
export interface ICommand {}
```

#### `ICommandHandler<TCommand>`

Interface for command handlers.

```typescript
export interface ICommandHandler<TCommand extends ICommand> {
  execute(command: TCommand): Promise<void>;
}
```

#### `IQuery`

Marker interface for queries.

```typescript
export interface IQuery {}
```

#### `IQueryHandler<TQuery, TResult>`

Interface for query handlers.

```typescript
export interface IQueryHandler<TQuery extends IQuery, TResult = any> {
  execute(query: TQuery): Promise<TResult>;
}
```

#### `IPipelineBehavior<TRequest, TResponse>`

Interface for pipeline behaviors (cross-cutting concerns).

```typescript
export interface IPipelineBehavior<TRequest = any, TResponse = any> {
  handle(request: TRequest, next: () => Promise<TResponse>): Promise<TResponse>;
}
```

### Decorators

#### `@CommandHandler(command)`

Marks a class as a command handler.

- **Parameters**: `command` - The command class this handler handles
- **Usage**: Apply to handler classes that implement `ICommandHandler`

#### `@QueryHandler(query)`

Marks a class as a query handler.

- **Parameters**: `query` - The query class this handler handles
- **Usage**: Apply to handler classes that implement `IQueryHandler`

#### `@PipelineBehavior(options?)`

Marks a class as a pipeline behavior.

- **Parameters**:
  - `options.priority` - Execution order (lower numbers execute first, default: 0)
  - `options.scope` - `'command'`, `'query'`, or `'all'` (default: `'all'`)
- **Usage**: Apply to behavior classes that implement `IPipelineBehavior`

### Services

#### `MediatorBus`

The main service for sending commands and queries.

##### Methods

**`send<TCommand>(command: TCommand): Promise<void>`**

Sends a command to its registered handler.

- **Parameters**: `command` - The command instance to execute
- **Returns**: Promise that resolves when the command is executed
- **Throws**: Error if no handler is registered for the command

**`query<TQuery, TResult>(query: TQuery): Promise<TResult>`**

Executes a query through its registered handler.

- **Parameters**: `query` - The query instance to execute
- **Returns**: Promise that resolves with the query result
- **Throws**: Error if no handler is registered for the query

### Module Configuration

#### `NestMediatorModule.forRoot()`

Basic module registration with no built-in behaviors.

#### `NestMediatorModule.forRootAsync(options)`

Module registration with configuration options.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enableLogging` | boolean | false | Enable request/response logging |
| `enableValidation` | boolean | false | Enable class-validator validation |
| `enableExceptionHandling` | boolean | false | Enable centralized exception logging |
| `enablePerformanceTracking` | boolean | false | Enable slow request warnings |
| `performanceThresholdMs` | number | 500 | Threshold for slow request warnings |
| `behaviors` | Type[] | [] | Additional custom behaviors to register |

## Pipeline Behaviors

Pipeline behaviors allow you to add cross-cutting concerns (like logging, validation, caching) that execute around every command and query handler.

### Enabling Built-in Behaviors

```typescript
import { Module } from '@nestjs/common';
import { NestMediatorModule } from '@rolandsall24/nest-mediator';

@Module({
  imports: [
    NestMediatorModule.forRootAsync({
      enableLogging: true,           // Logs request handling with timing
      enableValidation: true,        // Validates requests using class-validator
      enableExceptionHandling: true, // Centralized exception logging
      enablePerformanceTracking: true, // Warns on slow requests
      performanceThresholdMs: 500,   // Threshold for slow request warnings
    }),
  ],
})
export class AppModule {}
```

### Built-in Behaviors

| Behavior | Priority | Description |
|----------|----------|-------------|
| `ExceptionHandlingBehavior` | -100 | Catches and logs all exceptions |
| `LoggingBehavior` | 0 | Logs request handling with timing |
| `PerformanceBehavior` | 10 | Warns when requests exceed threshold |
| `ValidationBehavior` | 100 | Validates requests using class-validator |

### Creating Custom Behaviors

```typescript
import { Injectable } from '@nestjs/common';
import { IPipelineBehavior, PipelineBehavior } from '@rolandsall24/nest-mediator';

@Injectable()
@PipelineBehavior({ priority: 50, scope: 'all' })
export class MyCustomBehavior<TRequest, TResponse>
  implements IPipelineBehavior<TRequest, TResponse> {

  async handle(
    request: TRequest,
    next: () => Promise<TResponse>
  ): Promise<TResponse> {
    // Pre-processing logic
    console.log('Before handler:', request);

    // Call the next behavior or handler
    const response = await next();

    // Post-processing logic
    console.log('After handler:', response);

    return response;
  }
}
```

### Behavior Options

```typescript
@PipelineBehavior({
  priority: 50,      // Lower numbers execute first (outermost)
  scope: 'command',  // 'command', 'query', or 'all'
})
```

**Priority Guidelines:**
- `-100 to -1`: Exception handling (outermost)
- `0 to 99`: Logging, performance tracking
- `100 to 199`: Validation
- `200+`: Transaction/Unit of Work (innermost)

### Registering Custom Behaviors

Add your behavior to the module providers:

```typescript
@Module({
  imports: [
    NestMediatorModule.forRootAsync({
      behaviors: [MyCustomBehavior],
    }),
  ],
  providers: [
    MyCustomBehavior, // Also add to providers for DI
  ],
})
export class AppModule {}
```

Or use the `@PipelineBehavior` decorator and add to providers - it will be auto-discovered:

```typescript
@Module({
  imports: [NestMediatorModule.forRoot()],
  providers: [MyCustomBehavior], // Auto-discovered via decorator
})
export class AppModule {}
```

### Validation with class-validator

When `enableValidation` is true, requests are validated using class-validator (if installed):

```typescript
import { IsEmail, IsString, MinLength } from 'class-validator';
import { ICommand } from '@rolandsall24/nest-mediator';

export class CreateUserCommand implements ICommand {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(2)
  name: string;

  constructor(email: string, name: string) {
    this.email = email;
    this.name = name;
  }
}

// If validation fails, ValidationException is thrown with details
```

### Pipeline Execution Order

With behaviors at priorities -100, 0, 10, 100:

```
Request → ExceptionHandling(-100) → Logging(0) → Performance(10) → Validation(100) → Handler
Response ← ExceptionHandling(-100) ← Logging(0) ← Performance(10) ← Validation(100) ← Handler
```

## Best Practices

1. **Keep Commands and Queries Simple**: They should be simple data containers with minimal logic.

2. **One Handler Per Command/Query**: Each command or query should have exactly one handler.

3. **Use Dependency Injection**: Inject required services into your handlers through the constructor.

4. **Type Safety**: Always specify the return type for queries using the generic parameters.

5. **Error Handling**: Implement proper error handling in your handlers.

6. **Validation**: Validate command/query data before creating instances or in the handler.

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
