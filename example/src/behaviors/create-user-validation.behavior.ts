import { Injectable, Logger } from '@nestjs/common';
import { IPipelineBehavior, PipelineBehavior, Handle } from '@rolandsall24/nest-mediator';
import { CreateUserCommand } from '../users/commands/create-user.command';

/**
 * Type-specific validation behavior that ONLY applies to CreateUserCommand.
 *
 * This demonstrates the new type inference feature:
 * - By adding @Handle() to the handle method, the library automatically
 *   infers the request type from the method signature
 * - This behavior will ONLY run for CreateUserCommand instances
 * - No need for manual `instanceof` checks inside the handler
 *
 * Compare this to a generic behavior that uses `<TRequest = any>` which applies
 * to ALL requests matching the scope.
 */
@Injectable()
@PipelineBehavior({ priority: 95, scope: 'command' })
export class CreateUserValidationBehavior
  implements IPipelineBehavior<CreateUserCommand, void>
{
  private readonly logger = new Logger(CreateUserValidationBehavior.name);

  /**
   * The @Handle() decorator on this method enables automatic type inference.
   * TypeScript emits metadata for the `request: CreateUserCommand` parameter,
   * which the library reads at registration time.
   */
  @Handle()
  async handle(
    request: CreateUserCommand,
    next: () => Promise<void>,
  ): Promise<void> {
    this.logger.log(`Validating CreateUserCommand for user: ${request.name}`);

    // Custom validation logic specific to CreateUserCommand
    const errors: string[] = [];

    if (!request.name || request.name.trim().length === 0) {
      errors.push('Name is required');
    }

    if (request.name && request.name.length < 2) {
      errors.push('Name must be at least 2 characters');
    }

    if (!request.email || !this.isValidEmail(request.email)) {
      errors.push('Valid email is required');
    }

    if (errors.length > 0) {
      this.logger.error(`Validation failed: ${errors.join(', ')}`);
      throw new Error(`CreateUserCommand validation failed: ${errors.join(', ')}`);
    }

    this.logger.log('CreateUserCommand validation passed');
    return next();
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
