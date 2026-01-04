import { SetMetadata } from '@nestjs/common';
import { PipelineBehaviorOptions } from '../interfaces/pipeline-behavior.interface.js';

/**
 * Metadata key for pipeline behavior registration
 */
export const PIPELINE_BEHAVIOR_METADATA = 'PIPELINE_BEHAVIOR_METADATA';

/**
 * Metadata key to mark that the handle method has the decorator applied
 * (used to trigger design:paramtypes emission for type inference)
 */
export const PIPELINE_BEHAVIOR_HANDLE_METADATA = 'PIPELINE_BEHAVIOR_HANDLE_METADATA';

/**
 * Default options for pipeline behaviors
 */
const DEFAULT_OPTIONS: PipelineBehaviorOptions = {
  priority: 0,
  scope: 'all',
};

/**
 * Decorator that marks a class as a pipeline behavior.
 * Pipeline behaviors execute around request handlers, enabling cross-cutting concerns.
 *
 * @param options - Configuration options for the behavior
 * @returns Class decorator
 *
 * @example
 * ```typescript
 * // Basic usage - applies to all requests with default priority
 * @Injectable()
 * @PipelineBehavior()
 * export class LoggingBehavior implements IPipelineBehavior {
 *   async handle(request, next) {
 *     console.log('Handling:', request);
 *     return next();
 *   }
 * }
 *
 * // With priority - lower numbers execute first (outermost)
 * @Injectable()
 * @PipelineBehavior({ priority: -100 })
 * export class ExceptionHandlingBehavior implements IPipelineBehavior {
 *   async handle(request, next) {
 *     try {
 *       return await next();
 *     } catch (error) {
 *       // Handle error
 *       throw error;
 *     }
 *   }
 * }
 *
 * // Scoped to commands only
 * @Injectable()
 * @PipelineBehavior({ priority: 100, scope: 'command' })
 * export class CommandValidationBehavior implements IPipelineBehavior {
 *   async handle(request, next) {
 *     await this.validate(request);
 *     return next();
 *   }
 * }
 *
 * // Type-specific behavior - only applies to CreateUserCommand
 * // Use @Handle() on the method to enable automatic type inference
 * @Injectable()
 * @PipelineBehavior({ priority: 100, scope: 'command' })
 * export class CreateUserValidationBehavior implements IPipelineBehavior<CreateUserCommand, any> {
 *   @Handle()  // Enables type inference from method signature
 *   async handle(request: CreateUserCommand, next: () => Promise<any>): Promise<any> {
 *     // This behavior only runs for CreateUserCommand - no instanceof check needed!
 *     await this.validate(request);
 *     return next();
 *   }
 * }
 * ```
 */
export const PipelineBehavior = (
  options?: PipelineBehaviorOptions
): ClassDecorator => {
  const mergedOptions: PipelineBehaviorOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
  };
  return SetMetadata(PIPELINE_BEHAVIOR_METADATA, mergedOptions);
};

/**
 * Method decorator that enables automatic request type inference for pipeline behaviors.
 *
 * When applied to the `handle` method of a pipeline behavior, TypeScript emits
 * `design:paramtypes` metadata that the library reads to determine which request
 * type the behavior should apply to.
 *
 * @returns Method decorator
 *
 * @example
 * ```typescript
 * @Injectable()
 * @PipelineBehavior({ priority: 100, scope: 'command' })
 * export class CreateUserValidationBehavior
 *   implements IPipelineBehavior<CreateUserCommand, void>
 * {
 *   @Handle()  // Enables type inference - behavior only runs for CreateUserCommand
 *   async handle(
 *     request: CreateUserCommand,
 *     next: () => Promise<void>,
 *   ): Promise<void> {
 *     // No instanceof check needed - this only runs for CreateUserCommand
 *     if (!request.email.includes('@')) {
 *       throw new Error('Invalid email');
 *     }
 *     return next();
 *   }
 * }
 * ```
 */
export const Handle = (): MethodDecorator => {
  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor => {
    Reflect.defineMetadata(PIPELINE_BEHAVIOR_HANDLE_METADATA, true, target, propertyKey);
    return descriptor;
  };
};
