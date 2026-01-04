import { Injectable, Logger } from '@nestjs/common';
import { IPipelineBehavior, PipelineBehavior } from '@rolandsall24/nest-mediator';

/**
 * Simple in-memory cache for demonstration.
 * In production, use Redis or another caching solution.
 */
const cache = new Map<string, { data: any; expiry: number }>();

/**
 * Caching behavior for queries.
 * Caches query results to avoid repeated expensive operations.
 *
 * Scope: 'query' - only runs for mediator.query() calls
 * Priority: 5 - runs early (after logging at 0, before performance at 10)
 */
@Injectable()
@PipelineBehavior({ priority: 5, scope: 'query' })
export class CachingBehavior<TRequest = any, TResponse = any>
  implements IPipelineBehavior<TRequest, TResponse>
{
  private readonly logger = new Logger(CachingBehavior.name);
  private readonly defaultTtlMs = 30000; // 30 seconds

  async handle(
    request: TRequest,
    next: () => Promise<TResponse>,
  ): Promise<TResponse> {
    const cacheKey = this.generateCacheKey(request);

    // Check cache
    const cached = cache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      this.logger.log(`[CACHE HIT] ${this.getRequestName(request)}`);
      return cached.data;
    }

    // Cache miss - execute query
    this.logger.log(`[CACHE MISS] ${this.getRequestName(request)}`);
    const result = await next();

    // Store in cache
    cache.set(cacheKey, {
      data: result,
      expiry: Date.now() + this.defaultTtlMs,
    });

    return result;
  }

  private generateCacheKey(request: TRequest): string {
    const name = this.getRequestName(request);
    const data = JSON.stringify(request);
    return `${name}:${data}`;
  }

  private getRequestName(request: TRequest): string {
    if (request && typeof request === 'object' && request.constructor) {
      return request.constructor.name;
    }
    return 'UnknownRequest';
  }

  /**
   * Clear the cache (useful for testing)
   */
  static clearCache(): void {
    cache.clear();
  }
}
