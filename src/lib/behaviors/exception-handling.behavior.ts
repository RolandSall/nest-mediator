import { Injectable, Logger } from '@nestjs/common';
import { IPipelineBehavior } from '../interfaces/pipeline-behavior.interface.js';
import { PipelineBehavior } from '../decorators/pipeline-behavior.decorator.js';

/**
 * Interface for custom exception handlers.
 * Implement this to transform or handle specific exception types.
 */
export interface IExceptionHandler {
  /**
   * Check if this handler can handle the given error
   */
  canHandle(error: Error): boolean;

  /**
   * Handle the error - can transform it, log it, or rethrow
   */
  handle(error: Error, request: any): Error | Promise<Error>;
}

/**
 * Pipeline behavior that provides centralized exception handling.
 * This behavior wraps all other behaviors and handlers, catching any exceptions.
 *
 * Priority: -100 (executes first/outermost to catch all exceptions)
 *
 * Features:
 * - Catches all exceptions from the pipeline
 * - Logs exceptions with request context
 * - Can be extended with custom exception handlers
 *
 * @example
 * ```typescript
 * // The behavior automatically catches and logs all exceptions
 * await mediator.send(new CreateUserCommand('invalid'));
 * // If handler throws, ExceptionHandlingBehavior logs:
 * // [MediatorBus] Exception in CreateUserCommand: User validation failed
 * ```
 */
@Injectable()
@PipelineBehavior({ priority: -100, scope: 'all' })
export class ExceptionHandlingBehavior<TRequest = any, TResponse = any>
  implements IPipelineBehavior<TRequest, TResponse>
{
  private readonly logger = new Logger('MediatorBus');
  private readonly exceptionHandlers: IExceptionHandler[] = [];

  /**
   * Register a custom exception handler
   */
  registerExceptionHandler(handler: IExceptionHandler): void {
    this.exceptionHandlers.push(handler);
  }

  async handle(
    request: TRequest,
    next: () => Promise<TResponse>
  ): Promise<TResponse> {
    try {
      return await next();
    } catch (error) {
      const processedError = await this.processException(
        error as Error,
        request
      );
      throw processedError;
    }
  }

  private async processException(
    error: Error,
    request: TRequest
  ): Promise<Error> {
    const requestName = this.getRequestName(request);

    // Log the exception
    this.logger.error(
      `Exception in ${requestName}: ${error.message}`,
      error.stack
    );

    // Try custom exception handlers
    for (const handler of this.exceptionHandlers) {
      if (handler.canHandle(error)) {
        return handler.handle(error, request);
      }
    }

    // Return original error if no handler processed it
    return error;
  }

  private getRequestName(request: TRequest): string {
    if (request && typeof request === 'object' && request.constructor) {
      return request.constructor.name;
    }
    return 'UnknownRequest';
  }
}
