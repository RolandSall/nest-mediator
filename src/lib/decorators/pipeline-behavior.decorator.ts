import { SetMetadata } from '@nestjs/common';
import { PipelineBehaviorOptions } from '../interfaces/pipeline-behavior.interface.js';

/**
 * Metadata key for pipeline behavior registration
 */
export const PIPELINE_BEHAVIOR_METADATA = 'PIPELINE_BEHAVIOR_METADATA';

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
