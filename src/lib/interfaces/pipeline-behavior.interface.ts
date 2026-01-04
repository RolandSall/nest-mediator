/**
 * Pipeline behavior interface for implementing cross-cutting concerns.
 * Behaviors wrap around request handlers, allowing pre/post processing.
 *
 * @template TRequest - The request type (command or query)
 * @template TResponse - The response type
 *
 * @example
 * ```typescript
 * @Injectable()
 * @PipelineBehavior({ priority: 100 })
 * export class LoggingBehavior<TRequest, TResponse>
 *   implements IPipelineBehavior<TRequest, TResponse> {
 *
 *   async handle(request: TRequest, next: () => Promise<TResponse>): Promise<TResponse> {
 *     console.log('Before handler');
 *     const response = await next();
 *     console.log('After handler');
 *     return response;
 *   }
 * }
 * ```
 */
export interface IPipelineBehavior<TRequest = any, TResponse = any> {
  /**
   * Handle the request by executing pre-processing logic,
   * calling the next behavior/handler in the pipeline,
   * and executing post-processing logic.
   *
   * @param request - The incoming request object
   * @param next - Delegate to invoke the next behavior or final handler
   * @returns Promise with the response
   */
  handle(request: TRequest, next: () => Promise<TResponse>): Promise<TResponse>;
}

/**
 * Options for configuring pipeline behavior
 */
export interface PipelineBehaviorOptions {
  /**
   * Execution priority (lower numbers execute first).
   * Default: 0
   *
   * Suggested priority ranges:
   * - -100 to -1: Exception handling (outermost)
   * - 0 to 99: Logging, performance tracking
   * - 100 to 199: Validation
   * - 200+: Transaction/Unit of Work (innermost)
   */
  priority?: number;

  /**
   * Scope of the behavior.
   * - 'command': Only applies to commands (send)
   * - 'query': Only applies to queries (query)
   * - 'all': Applies to both commands and queries
   * Default: 'all'
   */
  scope?: 'command' | 'query' | 'all';
}
