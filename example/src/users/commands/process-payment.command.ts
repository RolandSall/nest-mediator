import { ICommand, SkipBehavior } from '@rolandsall24/nest-mediator';
import { AuditLoggingBehavior } from '../../behaviors';

/**
 * Command to process a payment.
 * This command demonstrates:
 * - Retry behavior (may fail transiently)
 * - Intentional failure mode for testing
 * - Skipping specific behaviors
 */
@SkipBehavior(AuditLoggingBehavior) // Skip audit for payment (sensitive data)
export class ProcessPaymentCommand implements ICommand {
  constructor(
    public readonly orderId: string,
    public readonly amount: number,
    /**
     * Set to true to simulate a transient failure (for testing retry)
     */
    public readonly simulateFailure: boolean = false,
    /**
     * Number of times to fail before succeeding (for retry testing)
     */
    public readonly failCount: number = 2,
  ) {}
}
