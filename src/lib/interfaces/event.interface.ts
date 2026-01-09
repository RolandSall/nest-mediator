/**
 * Marker interface for events
 * Events represent something that has happened in the domain.
 * Multiple handlers can subscribe to the same event.
 */
export interface IEvent {}

/**
 * Result of publishing an event
 */
export interface EventPublishResult {
  /**
   * Total number of handlers that were invoked
   */
  totalHandlers: number;

  /**
   * Number of critical handlers that executed successfully
   */
  criticalSucceeded: number;

  /**
   * Number of non-critical handlers that were dispatched
   * Note: Non-critical handlers run in background, so this only indicates they were started
   */
  nonCriticalDispatched: number;
}
