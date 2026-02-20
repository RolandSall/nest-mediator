/**
 * MediatorFlow Protocol Types
 *
 * Shared TypeScript interfaces used by both the exporter (nest-mediator library)
 * and the collector server (mediator-flow-server).
 */

// ─── Topology Registration Types ────────────────────────────────────────────

export interface CommandRegistration {
  commandName: string;
  handlerName: string;
}

export interface QueryRegistration {
  queryName: string;
  handlerName: string;
}

export interface ConsumerRegistration {
  consumerName: string;
  criticality: string;
  order: number;
  hasCompensation: boolean;
}

export interface EventRegistration {
  eventName: string;
  aggregateType?: string;
  consumers: ConsumerRegistration[];
}

export interface BehaviorRegistration {
  behaviorName: string;
  priority: number;
  scope: string;
  requestTypeName?: string;
}

export interface AggregateRegistration {
  aggregateType: string;
  repositoryName: string;
  eventTypes: string[];
}

export interface TopologyExport {
  serviceName: string;
  instanceId: string;
  bootedAt: string;
  libraryVersion: string;
  commands: CommandRegistration[];
  queries: QueryRegistration[];
  events: EventRegistration[];
  behaviors: BehaviorRegistration[];
  aggregates: AggregateRegistration[];
}

// ─── Execution Step Types ───────────────────────────────────────────────────

export enum StepType {
  // Command lifecycle
  COMMAND_DISPATCHED = 'COMMAND_DISPATCHED',
  COMMAND_HANDLER_STARTED = 'COMMAND_HANDLER_STARTED',
  COMMAND_HANDLER_COMPLETED = 'COMMAND_HANDLER_COMPLETED',
  COMMAND_HANDLER_FAILED = 'COMMAND_HANDLER_FAILED',

  // Query lifecycle
  QUERY_DISPATCHED = 'QUERY_DISPATCHED',
  QUERY_HANDLER_STARTED = 'QUERY_HANDLER_STARTED',
  QUERY_HANDLER_COMPLETED = 'QUERY_HANDLER_COMPLETED',
  QUERY_HANDLER_FAILED = 'QUERY_HANDLER_FAILED',

  // Event lifecycle
  EVENT_PUBLISHED = 'EVENT_PUBLISHED',

  // System consumer lifecycle
  SYSTEM_CONSUMER_STARTED = 'SYSTEM_CONSUMER_STARTED',
  SYSTEM_CONSUMER_COMPLETED = 'SYSTEM_CONSUMER_COMPLETED',
  SYSTEM_CONSUMER_FAILED = 'SYSTEM_CONSUMER_FAILED',

  // Critical consumer lifecycle
  CRITICAL_CONSUMER_STARTED = 'CRITICAL_CONSUMER_STARTED',
  CRITICAL_CONSUMER_COMPLETED = 'CRITICAL_CONSUMER_COMPLETED',
  CRITICAL_CONSUMER_FAILED = 'CRITICAL_CONSUMER_FAILED',

  // Non-critical consumer lifecycle
  NONCRITICAL_CONSUMER_DISPATCHED = 'NONCRITICAL_CONSUMER_DISPATCHED',
  NONCRITICAL_CONSUMER_COMPLETED = 'NONCRITICAL_CONSUMER_COMPLETED',
  NONCRITICAL_CONSUMER_FAILED = 'NONCRITICAL_CONSUMER_FAILED',

  // Behavior lifecycle
  BEHAVIOR_ENTERED = 'BEHAVIOR_ENTERED',
  BEHAVIOR_COMPLETED = 'BEHAVIOR_COMPLETED',
  BEHAVIOR_FAILED = 'BEHAVIOR_FAILED',

  // Compensation lifecycle
  COMPENSATION_STARTED = 'COMPENSATION_STARTED',
  COMPENSATION_COMPLETED = 'COMPENSATION_COMPLETED',
  COMPENSATION_FAILED = 'COMPENSATION_FAILED',
  COMPENSATING_EVENT_PUBLISHED = 'COMPENSATING_EVENT_PUBLISHED',

  // Retry lifecycle
  RETRY_ATTEMPTED = 'RETRY_ATTEMPTED',
}

export interface ExecutionStep {
  stepId: string;
  instanceId: string;
  type: StepType;
  timestamp: string;
  correlationId: string;
  causationId?: string;
  eventId?: string;
  durationMs?: number;
  name: string;
  error?: string;
  payload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface StepBatch {
  instanceId: string;
  serviceName: string;
  steps: ExecutionStep[];
}

// ─── Configuration ──────────────────────────────────────────────────────────

export interface MediatorFlowExporterConfig {
  enabled: boolean;
  collectorUrl: string;
  serviceName?: string;
  batchSize?: number;
  flushIntervalMs?: number;
  includePayloads?: boolean;
  httpTimeoutMs?: number;
}
