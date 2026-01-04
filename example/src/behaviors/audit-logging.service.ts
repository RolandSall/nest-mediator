import { Injectable, Logger } from '@nestjs/common';

/**
 * Dummy audit logging service that simulates saving audit logs
 */
@Injectable()
export class AuditLoggingService {
  private readonly logger = new Logger(AuditLoggingService.name);
  private auditLogs: AuditLog[] = [];

  async logAction(entry: AuditLog): Promise<void> {
    // Simulate async operation (e.g., saving to database)
    await this.simulateDbWrite();

    this.auditLogs.push(entry);
    this.logger.log(
      `[AUDIT] ${entry.action} by ${entry.userId} at ${entry.timestamp.toISOString()}`,
    );
  }

  getAuditLogs(): AuditLog[] {
    return this.auditLogs;
  }

  private simulateDbWrite(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 5));
  }
}

export interface AuditLog {
  action: string;
  userId: string;
  timestamp: Date;
  requestType: 'command' | 'query';
  requestName: string;
  metadata?: Record<string, any>;
}
