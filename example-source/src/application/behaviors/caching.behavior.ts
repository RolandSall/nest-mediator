import { Injectable, Logger } from '@nestjs/common';
import { IPipelineBehavior, PipelineBehavior } from '@rolandsall24/nest-mediator';

const cache = new Map<string, { data: any; expiry: number }>();

/**
 * Caching behavior for queries.
 * Scope: 'query' - only runs for mediator.query() calls
 */
@Injectable()
@PipelineBehavior({ priority: 5, scope: 'query' })
export class CachingBehavior<TRequest = any, TResponse = any>
  implements IPipelineBehavior<TRequest, TResponse>
{
  private readonly logger = new Logger(CachingBehavior.name);
  private readonly defaultTtlMs = 30000;

  async handle(
    request: TRequest,
    next: () => Promise<TResponse>,
  ): Promise<TResponse> {
    const cacheKey = this.generateCacheKey(request);

    const cached = cache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      this.logger.log(`[CACHE HIT] ${this.getRequestName(request)}`);
      return cached.data;
    }

    this.logger.log(`[CACHE MISS] ${this.getRequestName(request)}`);
    const result = await next();

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

  static clearCache(): void {
    cache.clear();
  }
}
