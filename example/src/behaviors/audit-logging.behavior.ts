import { Injectable } from '@nestjs/common';
import { IPipelineBehavior, PipelineBehavior } from '@rolandsall24/nest-mediator';
import { AuditLoggingService } from './audit-logging.service';

/**
 * Custom pipeline behavior that logs audit entries for commands only.
 *
 * KEY POINTS:
 * - scope: 'command' means this ONLY runs for mediator.send() calls
 * - scope: 'query' would mean ONLY for mediator.query() calls
 * - scope: 'all' (default) means it runs for BOTH
 *
 * Priority: 50 - runs after logging (0) but before validation (100)
 */
@Injectable()
@PipelineBehavior({ priority: 50, scope: 'command' }) // <-- Only for commands!
export class AuditLoggingBehavior<TRequest = any, TResponse = any>
  implements IPipelineBehavior<TRequest, TResponse>
{
  constructor(private readonly auditService: AuditLoggingService) {}

  async handle(
    request: TRequest,
    next: () => Promise<TResponse>,
  ): Promise<TResponse> {
    const requestName = this.getRequestName(request);

    // Log BEFORE the command executes
    await this.auditService.logAction({
      action: `Executing ${requestName}`,
      userId: 'user-123', // In real app, get from request context/auth
      timestamp: new Date(),
      requestType: 'command',
      requestName,
      metadata: this.extractMetadata(request),
    });

    try {
      // Execute the next behavior/handler in the pipeline
      const response = await next();

      // Log AFTER successful execution
      await this.auditService.logAction({
        action: `Completed ${requestName}`,
        userId: 'user-123',
        timestamp: new Date(),
        requestType: 'command',
        requestName,
      });

      return response;
    } catch (error) {
      // Log on failure
      await this.auditService.logAction({
        action: `Failed ${requestName}: ${(error as Error).message}`,
        userId: 'user-123',
        timestamp: new Date(),
        requestType: 'command',
        requestName,
      });

      throw error;
    }
  }

  private getRequestName(request: TRequest): string {
    if (request && typeof request === 'object' && request.constructor) {
      return request.constructor.name;
    }
    return 'UnknownRequest';
  }

  private extractMetadata(request: TRequest): Record<string, any> {
    if (request && typeof request === 'object') {
      // Extract non-sensitive fields for audit
      const metadata: Record<string, any> = {};
      for (const [key, value] of Object.entries(request)) {
        // Skip sensitive fields
        if (['password', 'token', 'secret'].includes(key.toLowerCase())) {
          metadata[key] = '[REDACTED]';
        } else {
          metadata[key] = value;
        }
      }
      return metadata;
    }
    return {};
  }
}
