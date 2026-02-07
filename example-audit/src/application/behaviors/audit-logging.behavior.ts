import { Injectable } from '@nestjs/common';
import { IPipelineBehavior, PipelineBehavior } from '@rolandsall24/nest-mediator';
import { AuditLoggingService } from './audit-logging.service';

/**
 * Custom pipeline behavior that logs audit entries for commands only.
 * scope: 'command' means this ONLY runs for mediator.send() calls
 */
@Injectable()
@PipelineBehavior({ priority: 50, scope: 'command' })
export class AuditLoggingBehavior<TRequest = any, TResponse = any>
  implements IPipelineBehavior<TRequest, TResponse>
{
  constructor(private readonly auditService: AuditLoggingService) {}

  async handle(
    request: TRequest,
    next: () => Promise<TResponse>,
  ): Promise<TResponse> {
    const requestName = this.getRequestName(request);

    await this.auditService.logAction({
      action: `Executing ${requestName}`,
      userId: 'user-123',
      timestamp: new Date(),
      requestType: 'command',
      requestName,
      metadata: this.extractMetadata(request),
    });

    try {
      const response = await next();

      await this.auditService.logAction({
        action: `Completed ${requestName}`,
        userId: 'user-123',
        timestamp: new Date(),
        requestType: 'command',
        requestName,
      });

      return response;
    } catch (error) {
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
      const metadata: Record<string, any> = {};
      for (const [key, value] of Object.entries(request)) {
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
