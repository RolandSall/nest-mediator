import { Injectable, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@rolandsall24/nest-mediator';
import { ProcessPaymentCommand } from './process-payment.command';

// Track failure counts per order to simulate transient failures
const failureTracker = new Map<string, number>();

@Injectable()
@CommandHandler(ProcessPaymentCommand)
export class ProcessPaymentHandler
  implements ICommandHandler<ProcessPaymentCommand>
{
  private readonly logger = new Logger(ProcessPaymentHandler.name);

  async execute(command: ProcessPaymentCommand): Promise<void> {
    const { orderId, amount, simulateFailure, failCount } = command;

    this.logger.log(`Processing payment for order ${orderId}: $${amount}`);

    // Simulate transient failure if enabled
    if (simulateFailure) {
      const currentFailures = failureTracker.get(orderId) ?? 0;

      if (currentFailures < failCount) {
        failureTracker.set(orderId, currentFailures + 1);
        this.logger.warn(
          `Payment failed (attempt ${currentFailures + 1}/${failCount + 1}) - simulating transient error`,
        );
        throw new Error(
          `Payment gateway temporarily unavailable (attempt ${currentFailures + 1})`,
        );
      }

      // Reset tracker after success
      failureTracker.delete(orderId);
    }

    // Simulate payment processing
    await new Promise((resolve) => setTimeout(resolve, 100));

    this.logger.log(`Payment processed successfully for order ${orderId}`);
  }

  /**
   * Reset the failure tracker (for testing)
   */
  static resetFailureTracker(): void {
    failureTracker.clear();
  }
}
