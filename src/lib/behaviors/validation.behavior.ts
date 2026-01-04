import { Injectable } from '@nestjs/common';
import { IPipelineBehavior } from '../interfaces/pipeline-behavior.interface.js';
import { PipelineBehavior } from '../decorators/pipeline-behavior.decorator.js';
import {
  ValidationException,
  ValidationError,
} from '../exceptions/validation.exception.js';

/**
 * Interface for custom validators.
 * Implement this interface to create validators for specific request types.
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class CreateUserCommandValidator implements IValidator<CreateUserCommand> {
 *   async validate(request: CreateUserCommand): Promise<ValidationError[]> {
 *     const errors: ValidationError[] = [];
 *
 *     if (!request.email) {
 *       errors.push({ property: 'email', message: 'Email is required' });
 *     }
 *
 *     return errors;
 *   }
 * }
 * ```
 */
export interface IValidator<TRequest> {
  /**
   * Validate the request and return any validation errors.
   * Return an empty array if validation passes.
   */
  validate(request: TRequest): Promise<ValidationError[]>;
}

/**
 * Metadata key for validator registration
 */
export const VALIDATOR_METADATA = 'VALIDATOR_METADATA';

/**
 * Pipeline behavior that performs validation using class-validator.
 * Validates request objects decorated with class-validator decorators.
 *
 * Priority: 100 (executes after logging but before handler)
 *
 * This behavior integrates with class-validator if available.
 * It will validate any request object that has class-validator decorators.
 *
 * @example
 * ```typescript
 * // Request with class-validator decorators
 * class CreateUserCommand implements ICommand {
 *   @IsEmail()
 *   email: string;
 *
 *   @IsString()
 *   @MinLength(2)
 *   name: string;
 * }
 *
 * // The ValidationBehavior will automatically validate this command
 * await mediator.send(new CreateUserCommand('invalid', 'a'));
 * // Throws ValidationException with details about the errors
 * ```
 */
@Injectable()
@PipelineBehavior({ priority: 100, scope: 'all' })
export class ValidationBehavior<TRequest = any, TResponse = any>
  implements IPipelineBehavior<TRequest, TResponse>
{
  private classValidatorAvailable: boolean | null = null;
  private validateFn: ((obj: object) => Promise<any[]>) | null = null;
  private getMetadataStorageFn: (() => any) | null = null;

  async handle(
    request: TRequest,
    next: () => Promise<TResponse>
  ): Promise<TResponse> {
    // Only validate objects
    if (!request || typeof request !== 'object') {
      return next();
    }

    const errors = await this.validateRequest(request);

    if (errors.length > 0) {
      throw new ValidationException(errors);
    }

    return next();
  }

  private async validateRequest(request: TRequest): Promise<ValidationError[]> {
    // Try to use class-validator if available
    await this.loadClassValidator();

    if (this.validateFn && this.getMetadataStorageFn) {
      try {
        // Check if the class has any validation decorators
        const metadataStorage = this.getMetadataStorageFn();
        const targetConstructor = (request as object).constructor;

        // Get validation metadata for this class
        const targetMetadatas =
          metadataStorage.getTargetValidationMetadatas(
            targetConstructor,
            targetConstructor.name,
            true, // always
            false // strictGroups
          ) || [];

        // If no validation decorators, skip validation
        if (targetMetadatas.length === 0) {
          return [];
        }

        const classValidatorErrors = await this.validateFn(request as object);
        return this.transformClassValidatorErrors(classValidatorErrors);
      } catch {
        // class-validator failed, skip validation
        return [];
      }
    }

    return [];
  }

  private async loadClassValidator(): Promise<void> {
    if (this.classValidatorAvailable !== null) {
      return;
    }

    try {
      // Dynamic import to avoid hard dependency on class-validator
      // Using Function constructor to prevent TypeScript from resolving the module
      const importFn = new Function(
        'moduleName',
        'return import(moduleName)'
      ) as (moduleName: string) => Promise<any>;

      const classValidator = await importFn('class-validator');
      this.validateFn = classValidator.validate;
      this.getMetadataStorageFn = classValidator.getMetadataStorage;
      this.classValidatorAvailable = true;
    } catch {
      this.classValidatorAvailable = false;
      this.validateFn = null;
      this.getMetadataStorageFn = null;
    }
  }

  private transformClassValidatorErrors(errors: any[]): ValidationError[] {
    const result: ValidationError[] = [];

    for (const error of errors) {
      if (error.constraints) {
        const messages = Object.values(error.constraints) as string[];
        for (const message of messages) {
          result.push({
            property: error.property,
            message,
            value: error.value,
          });
        }
      }

      // Handle nested validation errors
      if (error.children && error.children.length > 0) {
        const childErrors = this.transformClassValidatorErrors(error.children);
        for (const childError of childErrors) {
          result.push({
            ...childError,
            property: `${error.property}.${childError.property}`,
          });
        }
      }
    }

    return result;
  }
}
