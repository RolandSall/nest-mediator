/**
 * Exception thrown when no handler is registered for a request.
 *
 * @example
 * ```typescript
 * throw new HandlerNotFoundException('CreateUserCommand', 'command');
 * ```
 */
export class HandlerNotFoundException extends Error {
  public readonly requestName: string;
  public readonly requestType: 'command' | 'query';

  constructor(requestName: string, requestType: 'command' | 'query') {
    const message = `No handler registered for ${requestType}: ${requestName}. Did you forget to add @${requestType === 'command' ? 'CommandHandler' : 'QueryHandler'} decorator?`;
    super(message);
    this.name = 'HandlerNotFoundException';
    this.requestName = requestName;
    this.requestType = requestType;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, HandlerNotFoundException);
    }
  }

  toJSON(): {
    name: string;
    message: string;
    requestName: string;
    requestType: string;
  } {
    return {
      name: this.name,
      message: this.message,
      requestName: this.requestName,
      requestType: this.requestType,
    };
  }
}
