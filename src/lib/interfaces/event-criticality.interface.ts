/**
 * Criticality level for event consumers.
 * Determines how the consumer is executed when an event is published.
 */
export enum EventCriticality {
  /**
   * Critical consumers run sequentially in order.
   * - Must complete before non-critical consumers start
   * - If one fails, the publish operation fails
   * - Are awaited by the caller
   */
  CRITICAL = 'critical',

  /**
   * Non-critical consumers run in parallel after critical consumers complete.
   * - Fire and forget (not awaited by the caller)
   * - Failures are logged but don't affect the publish result
   * - Don't block the caller
   */
  NON_CRITICAL = 'non-critical',
}

/**
 * Metadata stored for event consumer criticality
 */
export interface EventCriticalityMetadata {
  criticality: EventCriticality;
  order: number;
}
