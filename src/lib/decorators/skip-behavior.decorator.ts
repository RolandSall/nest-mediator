import { SetMetadata } from '@nestjs/common';
import { Type } from '@nestjs/common/interfaces';
import { IPipelineBehavior } from '../interfaces/pipeline-behavior.interface';

/**
 * Metadata key for storing behaviors to skip on a command/query class
 */
export const SKIP_BEHAVIORS_METADATA = 'SKIP_BEHAVIORS_METADATA';

/**
 * Decorator to skip one or more pipeline behaviors for a specific command or query.
 *
 * Works with both built-in behaviors (PerformanceBehavior, LoggingBehavior, etc.)
 * and custom behaviors.
 *
 * @example
 * ```typescript
 * import { PerformanceBehavior, LoggingBehavior } from '@rolandsall24/nest-mediator';
 *
 * // Skip a single behavior
 * @SkipBehavior(PerformanceBehavior)
 * export class HighFrequencyCommand {}
 *
 * // Skip multiple behaviors
 * @SkipBehavior([PerformanceBehavior, LoggingBehavior])
 * export class HealthCheckCommand {}
 * ```
 */
export const SkipBehavior = (
  behavior: Type<IPipelineBehavior> | Type<IPipelineBehavior>[],
): ClassDecorator => {
  const behaviors = Array.isArray(behavior) ? behavior : [behavior];
  return SetMetadata(SKIP_BEHAVIORS_METADATA, behaviors);
};

/**
 * Decorator to skip multiple pipeline behaviors for a specific command or query.
 *
 * Works with both built-in behaviors and custom behaviors.
 *
 * @example
 * ```typescript
 * import {
 *   PerformanceBehavior,
 *   LoggingBehavior,
 *   ValidationBehavior
 * } from '@rolandsall24/nest-mediator';
 *
 * @SkipBehaviors([PerformanceBehavior, LoggingBehavior])
 * export class HealthCheckCommand {
 *   // This command will skip performance and logging behaviors
 * }
 *
 * @SkipBehaviors([ValidationBehavior])
 * export class InternalCommand {
 *   // This command will skip validation (use with caution!)
 * }
 * ```
 */
export const SkipBehaviors = (
  behaviors: Type<IPipelineBehavior>[],
): ClassDecorator => {
  return SetMetadata(SKIP_BEHAVIORS_METADATA, behaviors);
};
