import { Injectable, Logger } from '@nestjs/common';
import { IPipelineBehavior, PipelineBehavior } from '@rolandsall24/nest-mediator';

/**
 * Retry behavior for commands that may fail transiently.
 * Automatically retries failed operations with exponential backoff.
 *
 * Scope: 'command' - only runs for mediator.send() calls
 * Priority: -50 - runs early (wraps most other behaviors)
 */
@Injectable()
@PipelineBehavior({ priority: -50, scope: 'command' })
export class RetryBehavior<TRequest = any, TResponse = any>
  implements IPipelineBehavior<TRequest, TResponse>
{
  private readonly logger = new Logger(RetryBehavior.name);
  private readonly maxRetries = 3;
  private readonly initialDelayMs = 100;

  async handle(
    request: TRequest,
    next: () => Promise<TResponse>,
  ): Promise<TResponse> {
    const requestName = this.getRequestName(request);
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          this.logger.warn(
            `[RETRY] Attempt ${attempt}/${this.maxRetries} for ${requestName}`,
          );
        }
        return await next();
      } catch (error) {
        lastError = error as Error;

        // Don't retry on validation errors or not found errors
        if (this.isNonRetryableError(error)) {
          throw error;
        }

        if (attempt < this.maxRetries) {
          const delay = this.calculateDelay(attempt);
          this.logger.warn(
            `[RETRY] ${requestName} failed (attempt ${attempt}): ${lastError.message}. Retrying in ${delay}ms...`,
          );
          await this.sleep(delay);
        }
      }
    }

    this.logger.error(
      `[RETRY] ${requestName} failed after ${this.maxRetries} attempts`,
    );
    throw lastError;
  }

  private isNonRetryableError(error: unknown): boolean {
    if (error && typeof error === 'object') {
      const errorName = (error as Error).name || '';
      // Don't retry validation or business logic errors
      return (
        errorName.includes('Validation') ||
        errorName.includes('NotFound') ||
        errorName.includes('Unauthorized') ||
        errorName.includes('Forbidden')
      );
    }
    return false;
  }

  private calculateDelay(attempt: number): number {
    // Exponential backoff: 100ms, 200ms, 400ms, etc.
    return this.initialDelayMs * Math.pow(2, attempt - 1);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private getRequestName(request: TRequest): string {
    if (request && typeof request === 'object' && request.constructor) {
      return request.constructor.name;
    }
    return 'UnknownRequest';
  }
}
