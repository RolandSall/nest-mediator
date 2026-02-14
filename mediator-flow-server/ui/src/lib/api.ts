const BASE = '';

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(`${BASE}${url}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export interface TraceSummary {
  correlationId: string;
  startedAt: string;
  durationMs: number;
  stepCount: number;
  errorCount: number;
  compensationCount: number;
  entryName: string;
  serviceName: string;
  hasErrors: boolean;
  hasCompensations: boolean;
}

export interface Step {
  stepId: string;
  instanceId: string;
  type: string;
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

export interface Stats {
  commandsPerMin: number;
  queriesPerMin: number;
  errorRate: number;
  compensationCount: number;
  totalSteps: number;
  topErrors: { name: string; error: string; count: number }[];
  topSlow: { name: string; step_type: string; duration_ms: number }[];
}

export interface Topology {
  services: any[];
  commands: { commandName: string; handlerName: string; serviceName: string }[];
  queries: { queryName: string; handlerName: string; serviceName: string }[];
  events: {
    eventName: string;
    aggregateType?: string;
    serviceName: string;
    consumers: {
      consumerName: string;
      criticality: string;
      order: number;
      hasCompensation: boolean;
    }[];
  }[];
  behaviors: {
    behaviorName: string;
    priority: number;
    scope: string;
    requestTypeName?: string;
    serviceName: string;
  }[];
  aggregates: {
    aggregateType: string;
    repositoryName: string;
    eventTypes: string[];
    serviceName: string;
  }[];
}

export const api = {
  getStats: (service?: string, since?: string) => {
    const params = new URLSearchParams();
    if (service) params.set('service', service);
    if (since) params.set('since', since);
    return fetchJson<Stats>(`/api/stats?${params}`);
  },

  getTopology: (service?: string) =>
    fetchJson<Topology>(`/api/topology${service ? `?service=${service}` : ''}`),

  getTraces: (opts: {
    page?: number;
    limit?: number;
    hasErrors?: boolean;
    hasCompensations?: boolean;
    service?: string;
    since?: string;
    search?: string;
  } = {}) => {
    const params = new URLSearchParams();
    if (opts.page) params.set('page', String(opts.page));
    if (opts.limit) params.set('limit', String(opts.limit));
    if (opts.hasErrors !== undefined) params.set('hasErrors', String(opts.hasErrors));
    if (opts.hasCompensations !== undefined) params.set('hasCompensations', String(opts.hasCompensations));
    if (opts.service) params.set('service', opts.service);
    if (opts.since) params.set('since', opts.since);
    if (opts.search) params.set('search', opts.search);
    return fetchJson<{ traces: TraceSummary[]; total: number; page: number; limit: number }>(
      `/api/traces?${params}`,
    );
  },

  getTrace: (correlationId: string) =>
    fetchJson<{ correlationId: string; steps: Step[] }>(`/api/traces/${correlationId}`),

  getAggregateEvents: (type: string, id: string) =>
    fetchJson<{
      aggregateType: string;
      aggregateId: string;
      events: {
        stepId: string;
        eventName: string;
        timestamp: string;
        correlationId: string;
        payload?: Record<string, unknown>;
        metadata?: Record<string, unknown>;
      }[];
    }>(`/api/aggregates/${type}/${id}`),

  search: (q: string, type?: string) => {
    const params = new URLSearchParams({ q });
    if (type) params.set('type', type);
    return fetchJson<any[]>(`/api/search?${params}`);
  },
};
