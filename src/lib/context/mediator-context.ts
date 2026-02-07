import { AsyncLocalStorage } from 'async_hooks';
import { v4 as uuidv4 } from 'uuid';

/**
 * Context data that flows through async operations
 */
export interface MediatorContextData {
  /**
   * Unique identifier that groups all events in the same business transaction.
   * Generated once when a command/query enters the system.
   */
  correlationId: string;

  /**
   * Unique identifier of the direct cause of the current operation.
   * Points to the parent event that triggered this operation.
   */
  causationId?: string;

  /**
   * The event ID currently being processed.
   * Used by the persistence consumer as the stored event_id,
   * and by child events as their causation_id (parent→child link).
   */
  currentEventId?: string;
}

/**
 * Manages context propagation through async operations using AsyncLocalStorage.
 * Enables automatic tracking of correlation and causation IDs.
 */
class MediatorContextManager {
  private readonly storage = new AsyncLocalStorage<MediatorContextData>();

  /**
   * Run a callback within a new context.
   * Used when a command or query enters the system.
   *
   * @param callback - The async operation to execute
   * @returns The result of the callback
   */
  runWithNewContext<T>(callback: () => Promise<T>): Promise<T> {
    const context: MediatorContextData = {
      correlationId: uuidv4(),
      causationId: undefined,
    };
    return this.storage.run(context, callback);
  }

  /**
   * Run a callback with the same correlation but a new causation.
   * Used when an event handler publishes additional events.
   *
   * @param eventId - The ID of the event being published
   * @param callback - The async operation to execute
   * @returns The result of the callback
   */
  runWithCausation<T>(eventId: string, callback: () => Promise<T>): Promise<T> {
    const current = this.storage.getStore();
    const childContext: MediatorContextData = {
      correlationId: current?.correlationId ?? uuidv4(),
      causationId: current?.currentEventId,
      currentEventId: eventId,
    };
    return this.storage.run(childContext, callback);
  }

  /**
   * Get the current context.
   * If no context exists (detached async operation), creates a fallback with new correlationId.
   *
   * @returns The current context data
   */
  getContext(): MediatorContextData {
    const store = this.storage.getStore();
    if (store) {
      return store;
    }
    // Fallback for detached async operations
    return {
      correlationId: uuidv4(),
      causationId: undefined,
    };
  }

  /**
   * Check if currently within a managed context.
   *
   * @returns true if within a context, false otherwise
   */
  hasContext(): boolean {
    return this.storage.getStore() !== undefined;
  }

  /**
   * Get the current correlation ID.
   * Generates a new one if not in a context.
   *
   * @returns The correlation ID
   */
  getCorrelationId(): string {
    return this.getContext().correlationId;
  }

  /**
   * Get the current causation ID.
   *
   * @returns The causation ID or undefined if this is a root operation
   */
  getCausationId(): string | undefined {
    return this.getContext().causationId;
  }
}

/**
 * Singleton instance of the context manager.
 * Use this to access context throughout the application.
 */
export const mediatorContext = new MediatorContextManager();
