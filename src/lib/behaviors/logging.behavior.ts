import { Injectable, Logger } from '@nestjs/common';
import { IPipelineBehavior } from '../interfaces/pipeline-behavior.interface.js';
import { PipelineBehavior } from '../decorators/pipeline-behavior.decorator.js';

/**
 * Pipeline behavior that logs request handling.
 * Logs before execution, after successful execution (with duration), and on errors.
 *
 * Priority: 0 (executes early, wraps most other behaviors)
 *
 * @example
 * Output:
 * ```
 * [MediatorBus] Handling CreateUserCommand...
 * [MediatorBus] Handled CreateUserCommand successfully in 45ms
 * ```
 *
 * On error:
 * ```
 * [MediatorBus] Handling CreateUserCommand...
 * [MediatorBus] Failed CreateUserCommand after 12ms: User already exists
 * ```
 */
@Injectable()
@PipelineBehavior({ priority: 0, scope: 'all' })
export class LoggingBehavior<TRequest = any, TResponse = any>
  implements IPipelineBehavior<TRequest, TResponse>
{
  private readonly logger = new Logger('MediatorBus');

  async handle(
    request: TRequest,
    next: () => Promise<TResponse>
  ): Promise<TResponse> {
    const requestName = this.getRequestName(request);
    const startTime = Date.now();

    this.logger.log(`Handling ${requestName}...`);

    try {
      const response = await next();
      const elapsed = Date.now() - startTime;

      this.logger.log(`Handled ${requestName} successfully in ${elapsed}ms`);

      return response;
    } catch (error) {
      const elapsed = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(
        `Failed ${requestName} after ${elapsed}ms: ${errorMessage}`
      );

      throw error;
    }
  }

  private getRequestName(request: TRequest): string {
    if (request && typeof request === 'object' && request.constructor) {
      return request.constructor.name;
    }
    return 'UnknownRequest';
  }
}
