import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { IPipelineBehavior } from '../interfaces/pipeline-behavior.interface.js';
import { PipelineBehavior } from '../decorators/pipeline-behavior.decorator.js';

/**
 * Injection token for PerformanceBehavior options
 */
export const PERFORMANCE_BEHAVIOR_OPTIONS = 'PERFORMANCE_BEHAVIOR_OPTIONS';

/**
 * Configuration options for PerformanceBehavior
 */
export interface PerformanceBehaviorOptions {
  /**
   * Threshold in milliseconds. Requests exceeding this will be logged as warnings.
   * Default: 500ms
   */
  thresholdMs?: number;

  /**
   * Whether to log all requests or only slow ones.
   * Default: false (only log slow requests)
   */
  logAllRequests?: boolean;
}

/**
 * Pipeline behavior that tracks request performance.
 * Logs warnings for requests that exceed a configurable threshold.
 *
 * Priority: 10 (executes early to measure total pipeline time)
 *
 * @example
 * ```typescript
 * // Slow request output:
 * // [Performance] SLOW REQUEST: GetAllUsersQuery took 1234ms (threshold: 500ms)
 * ```
 */
@Injectable()
@PipelineBehavior({ priority: 10, scope: 'all' })
export class PerformanceBehavior<TRequest = any, TResponse = any>
  implements IPipelineBehavior<TRequest, TResponse>
{
  private readonly logger = new Logger('Performance');
  private readonly thresholdMs: number;
  private readonly logAllRequests: boolean;

  constructor(
    @Optional()
    @Inject(PERFORMANCE_BEHAVIOR_OPTIONS)
    options?: PerformanceBehaviorOptions
  ) {
    this.thresholdMs = options?.thresholdMs ?? 500;
    this.logAllRequests = options?.logAllRequests ?? false;
  }

  async handle(
    request: TRequest,
    next: () => Promise<TResponse>
  ): Promise<TResponse> {
    const requestName = this.getRequestName(request);
    const startTime = performance.now();

    try {
      return await next();
    } finally {
      const elapsed = Math.round(performance.now() - startTime);

      if (elapsed > this.thresholdMs) {
        this.logger.warn(
          `SLOW REQUEST: ${requestName} took ${elapsed}ms (threshold: ${this.thresholdMs}ms)`
        );
      } else if (this.logAllRequests) {
        this.logger.debug(`${requestName} completed in ${elapsed}ms`);
      }
    }
  }

  private getRequestName(request: TRequest): string {
    if (request && typeof request === 'object' && request.constructor) {
      return request.constructor.name;
    }
    return 'UnknownRequest';
  }
}
