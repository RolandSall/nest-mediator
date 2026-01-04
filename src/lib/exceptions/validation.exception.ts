/**
 * Represents a single validation error
 */
export interface ValidationError {
  /**
   * The property or field that failed validation
   */
  property: string;

  /**
   * Human-readable error message
   */
  message: string;

  /**
   * Optional error code for programmatic handling
   */
  code?: string;

  /**
   * The value that failed validation (optional)
   */
  value?: any;

  /**
   * Nested validation errors for complex objects
   */
  children?: ValidationError[];
}

/**
 * Exception thrown when request validation fails.
 * Contains detailed information about all validation errors.
 *
 * @example
 * ```typescript
 * throw new ValidationException([
 *   { property: 'email', message: 'Email is required' },
 *   { property: 'age', message: 'Age must be at least 18', code: 'MIN_AGE' }
 * ]);
 * ```
 */
export class ValidationException extends Error {
  public readonly errors: ValidationError[];

  constructor(errors: ValidationError[]) {
    const message = ValidationException.formatMessage(errors);
    super(message);
    this.name = 'ValidationException';
    this.errors = errors;

    // Maintains proper stack trace for where error was thrown (V8 engines)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ValidationException);
    }
  }

  /**
   * Format validation errors into a readable message
   */
  private static formatMessage(errors: ValidationError[]): string {
    if (errors.length === 0) {
      return 'Validation failed';
    }

    if (errors.length === 1) {
      return `Validation failed: ${errors[0].property} - ${errors[0].message}`;
    }

    const errorMessages = errors
      .map((e) => `${e.property}: ${e.message}`)
      .join('; ');

    return `Validation failed with ${errors.length} errors: ${errorMessages}`;
  }

  /**
   * Get errors for a specific property
   */
  getErrorsForProperty(property: string): ValidationError[] {
    return this.errors.filter((e) => e.property === property);
  }

  /**
   * Check if a specific property has errors
   */
  hasErrorForProperty(property: string): boolean {
    return this.errors.some((e) => e.property === property);
  }

  /**
   * Convert to a plain object for serialization
   */
  toJSON(): { name: string; message: string; errors: ValidationError[] } {
    return {
      name: this.name,
      message: this.message,
      errors: this.errors,
    };
  }
}
