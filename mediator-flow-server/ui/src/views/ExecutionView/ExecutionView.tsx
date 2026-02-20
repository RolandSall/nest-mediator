import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  type Node,
  type Edge,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { api, Step } from '../../lib/api';
import { formatDuration } from '../../lib/formatters';
import { layoutGraph } from '../../diagram';
import ResizableNode from '../../components/ResizableNode';
import CategoryLegend, { type LegendItem } from '../../components/CategoryLegend';
import FilterInput from '../../components/FilterInput';
import DetailPanel from '../../components/DetailPanel';
import StepDetail from '../../components/StepDetail';
import StatusDot from '../../components/StatusDot';

// ─── Types ────────────────────────────────────────────────────────────────────

type StepCategory =
  | 'command'
  | 'behavior'
  | 'handler'
  | 'event'
  | 'system_consumer'
  | 'critical_consumer'
  | 'noncritical_consumer'
  | 'compensation'
  | 'retry';

interface CompactItem {
  id: string;
  name: string;
  category: StepCategory;
  status: 'completed' | 'failed' | 'dispatched' | 'compensated';
  durationMs?: number;
  error?: string;
  steps: Step[];
  timestamp: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStepCategory(step: Step): StepCategory {
  const t = step.type;
  if (t === 'RETRY_ATTEMPTED') return 'retry';
  if (t.startsWith('COMPENSATION_') || t === 'COMPENSATING_EVENT_PUBLISHED') return 'compensation';
  if (t === 'COMMAND_DISPATCHED' || t === 'QUERY_DISPATCHED') return 'command';
  if (t.startsWith('BEHAVIOR_')) return 'behavior';
  if (t.includes('HANDLER')) return 'handler';
  if (t === 'EVENT_PUBLISHED') return 'event';
  if (t.startsWith('SYSTEM_CONSUMER_')) return 'system_consumer';
  if (t.startsWith('CRITICAL_CONSUMER_')) return 'critical_consumer';
  if (t.startsWith('NONCRITICAL_CONSUMER_')) return 'noncritical_consumer';
  return 'handler';
}

function stepStatus(step: Step): 'completed' | 'failed' | 'compensated' | 'dispatched' {
  if (step.error) return 'failed';
  if (step.type.startsWith('COMPENSATION_')) return 'compensated';
  if (step.type.endsWith('_DISPATCHED')) return 'dispatched';
  return 'completed';
}

// ─── Step sorting ─────────────────────────────────────────────────────────────

function sortStepsByTimestamp(steps: Step[]): Step[] {
  return [...steps].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

// ─── Compact list builder ─────────────────────────────────────────────────────

function buildCompactList(steps: Step[], hiddenCategories: Set<string>): CompactItem[] {
  const isStartStep = (t: string) =>
    t === 'BEHAVIOR_ENTERED' || t.endsWith('_STARTED') || t.endsWith('_DISPATCHED');
  const isEndStep = (t: string) =>
    t === 'BEHAVIOR_COMPLETED' || t === 'BEHAVIOR_FAILED' ||
    t.endsWith('_COMPLETED') || t.endsWith('_FAILED');
  const isStandalone = (t: string) =>
    t === 'COMMAND_DISPATCHED' || t === 'QUERY_DISPATCHED' ||
    t === 'EVENT_PUBLISHED' || t === 'COMPENSATING_EVENT_PUBLISHED' ||
    t === 'RETRY_ATTEMPTED';

  const items: CompactItem[] = [];
  const consumed = new Set<string>();

  for (const step of steps) {
    if (consumed.has(step.stepId)) continue;
    const category = getStepCategory(step);
    if (hiddenCategories.has(category)) continue;

    if (isStandalone(step.type)) {
      consumed.add(step.stepId);

      // Merge EVENT_PUBLISHED into prior COMPENSATING_EVENT_PUBLISHED with same name
      // (old data emits both for the same compensation event — they should be one node)
      if (step.type === 'EVENT_PUBLISHED') {
        const compItem = items.find(
          (it) => it.steps[0].type === 'COMPENSATING_EVENT_PUBLISHED' && it.name === step.name,
        );
        if (compItem) {
          compItem.steps.push(step);
          continue;
        }
      }

      items.push({ id: step.stepId, name: step.name, category, status: stepStatus(step), durationMs: step.durationMs, error: step.error, steps: [step], timestamp: step.timestamp });
      continue;
    }

    if (isStartStep(step.type)) {
      consumed.add(step.stepId);
      const end = steps.find((s) => s.name === step.name && isEndStep(s.type) && !consumed.has(s.stepId));
      const groupSteps = [step];
      if (end) { consumed.add(end.stepId); groupSteps.push(end); }
      items.push({ id: step.stepId, name: step.name, category, status: end?.error ? 'failed' : end ? stepStatus(end) : stepStatus(step), durationMs: end?.durationMs ?? step.durationMs, error: end?.error ?? step.error, steps: groupSteps, timestamp: step.timestamp });
      continue;
    }

    consumed.add(step.stepId);
    items.push({ id: step.stepId, name: step.name, category, status: step.error ? 'failed' : stepStatus(step), durationMs: step.durationMs, error: step.error, steps: [step], timestamp: step.timestamp });
  }

  return items;
}

// ─── Color config ─────────────────────────────────────────────────────────────

const categoryColors: Record<StepCategory, { bg: string; border: string; text: string }> = {
  command:              { bg: '#1e3a5f', border: '#3b82f6', text: '#93c5fd' },
  behavior:            { bg: '#581c87', border: '#a855f7', text: '#e9d5ff' },
  handler:             { bg: '#14532d', border: '#22c55e', text: '#bbf7d0' },
  event:               { bg: '#92400e', border: '#f59e0b', text: '#fcd34d' },
  system_consumer:     { bg: '#374151', border: '#6b7280', text: '#d1d5db' },
  critical_consumer:   { bg: '#7f1d1d', border: '#ef4444', text: '#fca5a5' },
  noncritical_consumer:{ bg: '#064e3b', border: '#10b981', text: '#a7f3d0' },
  compensation:        { bg: '#831843', border: '#ec4899', text: '#f9a8d4' },
  retry:               { bg: '#78350f', border: '#f97316', text: '#fdba74' },
};

const categoryConfig: LegendItem[] = [
  { type: 'command', label: 'Command', color: '#1e3a5f' },
  { type: 'handler', label: 'Handler', color: '#14532d' },
  { type: 'event', label: 'Event', color: '#92400e' },
  { type: 'system_consumer', label: 'Sys Consumer', color: '#374151' },
  { type: 'critical_consumer', label: 'Critical', color: '#7f1d1d' },
  { type: 'noncritical_consumer', label: 'Non-Critical', color: '#064e3b' },
  { type: 'compensation', label: 'Compensation', color: '#831843' },
];

const categoryLabels: Record<StepCategory, string> = {
  command: 'Command', behavior: 'Behavior', handler: 'Handler', event: 'Event',
  system_consumer: 'Sys Consumer', critical_consumer: 'Critical',
  noncritical_consumer: 'Non-Critical', compensation: 'Compensation', retry: 'Retry',
};

// ─── Retry attempt splitting ──────────────────────────────────────────────────

interface AttemptGroup {
  attemptNumber: number;
  items: CompactItem[];
  failed: boolean;
}

function splitByRetryAttempts(items: CompactItem[]): AttemptGroup[] {
  const groups: AttemptGroup[] = [];
  let currentItems: CompactItem[] = [];
  let attemptNumber = 1;

  for (const item of items) {
    if (item.category === 'retry') {
      // RETRY_ATTEMPTED marks the boundary — close current attempt
      groups.push({
        attemptNumber,
        items: currentItems,
        failed: currentItems.some((it) => it.status === 'failed'),
      });
      currentItems = [];
      attemptNumber++;
    } else {
      currentItems.push(item);
    }
  }

  // Final attempt (after last retry, or the only attempt if no retries)
  if (currentItems.length > 0) {
    groups.push({
      attemptNumber,
      items: currentItems,
      failed: currentItems.some((it) => it.status === 'failed'),
    });
  }

  return groups;
}

// ─── Graph builder ────────────────────────────────────────────────────────────

function estimateWidth(text: string): number {
  return Math.max(160, Math.min(280, text.length * 7 + 32));
}

function itemColors(item: CompactItem): { bg: string; border: string; text: string } {
  const base = categoryColors[item.category];
  return item.error ? { ...base, border: '#ef4444' } : base;
}

/**
 * Build a graph (nodes + edges) from a list of compact items.
 * This is used for a single attempt's items — no RETRY_ATTEMPTED items expected.
 */
function buildGraphFromItems(items: CompactItem[]): { nodes: Node[]; edges: Edge[] } {
  if (items.length === 0) return { nodes: [], edges: [] };

  const itemIdSet = new Set(items.map((it) => it.id));
  const primaryStep = (item: CompactItem) => item.steps[0];

  // Map eventId → item id for event items
  // EVENT_PUBLISHED steps always go in (including merged compensation items which carry the real eventId)
  // COMPENSATING_EVENT_PUBLISHED only goes in when it has no merged EVENT_PUBLISHED (new data)
  const eventPublishedMap = new Map<string, string>();
  items.forEach((it) => {
    const hasMergedEventPublished = it.steps.some((s) => s.type === 'EVENT_PUBLISHED');
    for (const s of it.steps) {
      if (s.eventId && s.type === 'EVENT_PUBLISHED') {
        eventPublishedMap.set(s.eventId, it.id);
      }
    }
    const s0 = primaryStep(it);
    if (s0.type === 'COMPENSATING_EVENT_PUBLISHED' && s0.eventId && !hasMergedEventPublished) {
      eventPublishedMap.set(s0.eventId, it.id);
    }
  });

  // Map (eventId:name) → item id for consumer/handler items (event-scoped)
  const startedItemMap = new Map<string, string>();
  items.forEach((it) => {
    const s = primaryStep(it);
    if (s.eventId && (s.type.endsWith('_STARTED') || s.type === 'NONCRITICAL_CONSUMER_DISPATCHED')) {
      startedItemMap.set(`${s.eventId}:${s.name}`, it.id);
    }
  });

  // Backward-scanning lookup for command/query handlers by name
  const findNearestEntered = (name: string, beforeIndex: number): string | undefined => {
    for (let j = beforeIndex - 1; j >= 0; j--) {
      const s = primaryStep(items[j]);
      if (
        s.name === name &&
        !s.eventId &&
        (s.type === 'BEHAVIOR_ENTERED' || s.type === 'COMMAND_HANDLER_STARTED' || s.type === 'QUERY_HANDLER_STARTED')
      ) {
        return items[j].id;
      }
    }
    return undefined;
  };

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Create one node per compact item
  items.forEach((item) => {
    const colors = itemColors(item);
    const isNonCritical = item.category === 'noncritical_consumer';
    const step0 = primaryStep(item);

    // For merged compensation items (old data), use EVENT_PUBLISHED step's eventId/causationId
    let detailStep = step0;
    if (step0.type === 'COMPENSATING_EVENT_PUBLISHED' && item.steps.length > 1) {
      const pubStep = item.steps.find((s) => s.type === 'EVENT_PUBLISHED');
      if (pubStep) {
        detailStep = { ...step0, eventId: pubStep.eventId, causationId: pubStep.causationId };
      }
    }

    // Build label — critical consumers show their order number
    let label = item.name;
    if (item.category === 'critical_consumer' && step0.metadata?.order != null) {
      label = `[${step0.metadata.order}] ${label}`;
    }
    if (item.durationMs != null && item.category !== 'event' && item.category !== 'compensation') {
      label += `\n${formatDuration(item.durationMs)}`;
    }
    const w = estimateWidth(item.name);

    nodes.push({
      id: item.id,
      type: 'resizable',
      data: {
        label,
        width: w,
        height: 50,
        step: detailStep,
        category: item.category,
        bg: colors.bg,
        color: colors.text,
        border: `${isNonCritical ? '2px dashed' : '1px solid'} ${colors.border}`,
        borderColor: colors.border,
        borderRadius: 8,
        fontSize: 10,
        padding: '6px 10px',
        whiteSpace: 'pre-line',
        minWidth: 100,
        minHeight: 40,
      },
      position: { x: 0, y: 0 },
      style: { width: w, height: 50 },
    });
  });

  // Build edges between compact items
  items.forEach((item, i) => {
    const step = primaryStep(item);
    const isNonCritical = item.category === 'noncritical_consumer';
    const edgeStyle = isNonCritical ? { strokeDasharray: '5,5' } : undefined;
    const edgeLabel = isNonCritical ? '||' : undefined;
    const edgeLabelStyle = isNonCritical ? { fill: '#9ca3af', fontSize: 10 } : undefined;

    // Compensation chain: COMPENSATING_EVENT_PUBLISHED → sequential from preceding item
    if (step.type === 'COMPENSATING_EVENT_PUBLISHED') {
      if (i > 0) {
        edges.push({
          id: `e-${items[i - 1].id}-${item.id}`,
          source: items[i - 1].id,
          target: item.id,
        });
      }
      return;
    }

    // Published events with publishedBy → link to the handler that published it
    const publisherName = step.metadata?.publishedBy as string | undefined;
    if (
      (step.type === 'EVENT_PUBLISHED' || step.type === 'COMPENSATING_EVENT_PUBLISHED') &&
      publisherName
    ) {
      // Try event-scoped lookup first
      for (const [key, id] of startedItemMap) {
        if (key.endsWith(`:${publisherName}`) && itemIdSet.has(id)) {
          edges.push({
            id: `e-${id}-${item.id}`,
            source: id,
            target: item.id,
            style: edgeStyle,
            label: edgeLabel,
            labelStyle: edgeLabelStyle,
          });
          return;
        }
      }
      // Try backward-scanning lookup
      const enteredId = findNearestEntered(publisherName, i);
      if (enteredId && itemIdSet.has(enteredId)) {
        edges.push({
          id: `e-${enteredId}-${item.id}`,
          source: enteredId,
          target: item.id,
          style: edgeStyle,
          label: edgeLabel,
          labelStyle: edgeLabelStyle,
        });
        return;
      }
    }

    // Consumer/handler STARTED → link to EVENT_PUBLISHED with same eventId
    if (
      step.eventId &&
      (step.type.endsWith('_STARTED') || step.type === 'NONCRITICAL_CONSUMER_DISPATCHED')
    ) {
      const pubId = eventPublishedMap.get(step.eventId);
      if (pubId && pubId !== item.id && itemIdSet.has(pubId)) {
        edges.push({
          id: `e-${pubId}-${item.id}`,
          source: pubId,
          target: item.id,
          style: edgeStyle,
          label: edgeLabel,
          labelStyle: edgeLabelStyle,
        });
        return;
      }
    }

    // Fallback: sequential link to previous item
    if (i > 0) {
      edges.push({
        id: `e-${items[i - 1].id}-${item.id}`,
        source: items[i - 1].id,
        target: item.id,
      });
    }
  });

  return layoutGraph(nodes, edges, 'LR');
}

/**
 * Top-level graph builder.
 * Sorts steps, builds compact items, detects retries, and either:
 * - Returns a single graph (no retries)
 * - Returns stacked detached graphs with retry divider banners (retries detected)
 */
function buildExecutionGraph(steps: Step[], hiddenCategories: Set<string>) {
  const sorted = sortStepsByTimestamp(steps);
  const items = buildCompactList(sorted, hiddenCategories);
  const attempts = splitByRetryAttempts(items);

  // No retries — single graph
  if (attempts.length <= 1) {
    return buildGraphFromItems(items);
  }

  // Multiple attempts — build separate graphs, stack vertically
  const allNodes: Node[] = [];
  const allEdges: Edge[] = [];
  let yOffset = 0;
  const ATTEMPT_GAP = 80;

  for (let a = 0; a < attempts.length; a++) {
    const attempt = attempts[a];
    if (attempt.items.length === 0) continue;

    // Add retry divider banner before attempts 2+
    if (a > 0) {
      const dividerId = `retry-divider-${a}`;
      allNodes.push({
        id: dividerId,
        type: 'resizable',
        data: {
          label: `Retry — Attempt ${attempt.attemptNumber}`,
          width: 260,
          height: 32,
          category: 'retry',
          bg: '#78350f',
          color: '#fdba74',
          border: '2px dashed #f97316',
          borderColor: '#f97316',
          borderRadius: 6,
          fontSize: 11,
          padding: '4px 16px',
          whiteSpace: 'nowrap',
          minWidth: 200,
          minHeight: 28,
        },
        position: { x: 0, y: yOffset },
        style: { width: 260, height: 32 },
      });
      yOffset += 32 + 30;
    }

    // Build this attempt's independent graph
    const { nodes, edges } = buildGraphFromItems(attempt.items);
    if (nodes.length === 0) continue;

    // Calculate bounding box of this attempt's graph
    const minY = Math.min(...nodes.map((n) => n.position.y));
    const maxY = Math.max(
      ...nodes.map((n) => n.position.y + ((n.data.height as number) ?? 50)),
    );
    const graphHeight = maxY - minY;

    // Offset Y positions to stack below previous attempt
    const yShift = yOffset - minY;
    for (const n of nodes) {
      n.position = { ...n.position, y: n.position.y + yShift };
      allNodes.push(n);
    }
    allEdges.push(...edges);

    yOffset += graphHeight + ATTEMPT_GAP;
  }

  return { nodes: allNodes, edges: allEdges };
}

// ─── Node type registration ──────────────────────────────────────────────────

const nodeTypes = { resizable: ResizableNode };

// ─── Component ────────────────────────────────────────────────────────────────

export default function ExecutionView() {
  const { correlationId } = useParams<{ correlationId: string }>();
  const [selectedStep, setSelectedStep] = useState<Step | null>(null);
  const [viewMode, setViewMode] = useState<'flow' | 'sequence'>('flow');
  const [compact, setCompact] = useState(false);
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set(['behavior']));
  const [filter, setFilter] = useState('');
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);
  const [expandedCompactId, setExpandedCompactId] = useState<string | null>(null);

  const detailRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['trace', correlationId],
    queryFn: () => api.getTrace(correlationId!),
    enabled: !!correlationId,
  });

  const toggleCategory = useCallback((type: string) => {
    setHiddenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  // Sort steps once (fixes wrong edges from unsorted API responses)
  const sortedSteps = useMemo(() => {
    if (!data?.steps.length) return [];
    return sortStepsByTimestamp(data.steps);
  }, [data]);

  const compactItems = useMemo(() => {
    if (!sortedSteps.length) return [];
    return buildCompactList(sortedSteps, hiddenCategories);
  }, [sortedSteps, hiddenCategories]);

  // Split compact items into retry attempt groups
  const attemptGroups = useMemo(() => {
    return splitByRetryAttempts(compactItems);
  }, [compactItems]);

  const hasRetries = attemptGroups.length > 1;

  const { nodes: layoutNodes, edges: layoutEdges } = useMemo(() => {
    if (!sortedSteps.length) return { nodes: [], edges: [] };
    const result = buildExecutionGraph(sortedSteps, hiddenCategories);

    if (filter) {
      const lower = filter.toLowerCase();
      const matchIds = new Set(
        result.nodes
          .filter((n) => (n.data.label as string).toLowerCase().includes(lower))
          .map((n) => n.id),
      );
      return {
        nodes: result.nodes.map((n) => ({
          ...n,
          style: { ...n.style, opacity: matchIds.has(n.id) ? 1 : 0.15 },
        })),
        edges: result.edges,
      };
    }
    return result;
  }, [sortedSteps, hiddenCategories, filter]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutEdges);

  useEffect(() => {
    setNodes(layoutNodes);
    setEdges(layoutEdges);
  }, [layoutNodes, layoutEdges, setNodes, setEdges]);

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedStep(node.data.step as Step);
  }, []);

  useEffect(() => {
    if (selectedStep && viewMode === 'flow' && detailRef.current)
      detailRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedStep, viewMode]);

  const compensationSteps =
    data?.steps.filter(
      (s) => s.type.startsWith('COMPENSATION_') || s.type === 'COMPENSATING_EVENT_PUBLISHED',
    ) ?? [];

  if (isLoading) return <div className="text-gray-500">Loading trace...</div>;
  if (!data) return <div className="text-gray-500">Trace not found.</div>;

  // ─── Shared compact item row renderer ───────────────────────────────────────
  const renderCompactRow = (item: CompactItem, idx: number) => {
    const catColor = categoryColors[item.category];
    return (
      <div key={item.id}>
        <div
          className={`flex items-center gap-3 text-xs py-2 cursor-pointer hover:bg-gray-800/30 px-2 rounded ${expandedCompactId === item.id ? 'bg-gray-800/50' : ''}`}
          onClick={() => setExpandedCompactId(expandedCompactId === item.id ? null : item.id)}
        >
          <span className="text-gray-500 w-6 shrink-0 font-mono text-right">{idx + 1}</span>
          <StatusDot status={item.status} />
          <span
            className="w-24 shrink-0 text-xs text-center px-1.5 py-0.5 rounded"
            style={{ color: catColor.text, background: catColor.bg }}
          >
            {categoryLabels[item.category]}
          </span>
          <span className="text-gray-300 truncate">{item.name}</span>
          {item.durationMs !== undefined && item.category !== 'event' && item.category !== 'compensation' && (
            <span className="text-gray-600 ml-auto shrink-0">
              {formatDuration(item.durationMs)}
            </span>
          )}
          {item.error && (
            <span className="text-red-400 truncate max-w-xs">{item.error}</span>
          )}
          <span className="text-gray-600 ml-1 shrink-0">
            {expandedCompactId === item.id ? '\u25BC' : '\u25B6'}
          </span>
        </div>
        {expandedCompactId === item.id && (
          <div className="ml-8 mr-2 mb-2 p-4 bg-gray-950 border border-gray-800 rounded-lg text-sm">
            {item.steps.map((step) => (
              <div key={step.stepId} className="mb-3 last:mb-0">
                <div className="text-xs text-gray-500 mb-1 font-mono">{step.type}</div>
                <StepDetail step={step} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ─── Attempt header renderer ────────────────────────────────────────────────
  const renderAttemptHeader = (attempt: AttemptGroup) => (
    <div
      key={`attempt-header-${attempt.attemptNumber}`}
      className="flex items-center gap-3 my-3 px-2"
    >
      <div className="flex-1 border-t border-orange-500/40" />
      <span
        className={`text-xs font-semibold px-3 py-1 rounded-full border ${
          attempt.failed
            ? 'text-red-400 bg-red-950/40 border-red-500/40'
            : 'text-green-400 bg-green-950/40 border-green-500/40'
        }`}
      >
        Attempt {attempt.attemptNumber} &mdash;{' '}
        {attempt.failed ? 'Failed' : 'Succeeded'}
      </span>
      <div className="flex-1 border-t border-orange-500/40" />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link to="/traces" className="text-blue-400 text-sm hover:underline">
            Back to Traces
          </Link>
          <h1 className="text-xl font-bold mt-1">Execution Trace</h1>
          <p className="text-xs text-gray-500 font-mono">{correlationId}</p>
        </div>
        <div className="flex gap-2">
          {(['flow', 'sequence'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1 text-sm rounded capitalize ${viewMode === mode ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Flow mode ─────────────────────────────────────────────── */}
      {viewMode === 'flow' && (
        <div
          className="relative bg-gray-900 border border-gray-800 rounded-lg"
          style={{ height: 'calc(100vh - 200px)', minHeight: 500 }}
        >
          <div className="absolute top-2 left-2 z-10 bg-gray-900/90 border border-gray-700 rounded-lg px-3 py-2 flex items-center gap-2">
            <FilterInput value={filter} onChange={setFilter} />
          </div>

          <div className="absolute bottom-2 left-2 z-10 bg-gray-900/90 border border-gray-700 rounded-lg px-3 py-2">
            <CategoryLegend
              items={categoryConfig}
              hiddenSet={hiddenCategories}
              onToggle={toggleCategory}
            />
          </div>

          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <MiniMap
              nodeStrokeWidth={3}
              nodeColor={(node) => (node.style?.background as string) || '#1f2937'}
              maskColor="rgba(0, 0, 0, 0.7)"
              style={{ background: '#111827', border: '1px solid #374151' }}
            />
            <Controls />
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1f2937" />
          </ReactFlow>

          {selectedStep && (
            <DetailPanel
              ref={detailRef}
              title="Step Detail"
              onClose={() => setSelectedStep(null)}
            >
              <StepDetail step={selectedStep} />
            </DetailPanel>
          )}
        </div>
      )}

      {/* ─── Sequence mode ─────────────────────────────────────────── */}
      {viewMode === 'sequence' && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 overflow-x-auto">
          <div className="mb-3 flex items-center gap-3">
            <CategoryLegend
              items={categoryConfig}
              hiddenSet={hiddenCategories}
              onToggle={toggleCategory}
            />
            <button
              onClick={() => setCompact((v) => !v)}
              className={`ml-auto shrink-0 px-2.5 py-1 text-xs rounded border transition-colors ${compact ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-transparent border-gray-700 text-gray-500 hover:text-gray-300'}`}
            >
              Compact
            </button>
          </div>

          <div className="space-y-0">
            {compact
              ? hasRetries
                ? /* Compact mode WITH retries — show attempt headers between groups */
                  attemptGroups.flatMap((attempt) => {
                    const header = renderAttemptHeader(attempt);
                    const rows = attempt.items.map((item, idx) => renderCompactRow(item, idx));
                    return [header, ...rows];
                  })
                : /* Compact mode without retries — flat list */
                  compactItems.map((item, idx) => renderCompactRow(item, idx))
              : /* Non-compact raw step mode — use sorted steps */
                sortedSteps
                  .filter((s) => !hiddenCategories.has(getStepCategory(s)))
                  .map((step, idx) => {
                    const catColor = categoryColors[getStepCategory(step)];
                    const isRetryStep = step.type === 'RETRY_ATTEMPTED';
                    return (
                      <div key={step.stepId}>
                        {/* Retry step gets a prominent divider style */}
                        {isRetryStep && (
                          <div className="flex items-center gap-3 my-3 px-2">
                            <div className="flex-1 border-t border-orange-500/40" />
                            <span className="text-xs font-semibold px-3 py-1 rounded-full border text-orange-400 bg-orange-950/40 border-orange-500/40">
                              Retry Attempt
                            </span>
                            <div className="flex-1 border-t border-orange-500/40" />
                          </div>
                        )}
                        <div
                          className={`flex items-center gap-3 text-xs py-2 cursor-pointer hover:bg-gray-800/30 px-2 rounded ${expandedStepId === step.stepId ? 'bg-gray-800/50' : ''}`}
                          onClick={() =>
                            setExpandedStepId(
                              expandedStepId === step.stepId ? null : step.stepId,
                            )
                          }
                        >
                          <span
                            className="inline-block w-2 h-2 rounded-full shrink-0"
                            style={{
                              background: step.error ? '#ef4444' : catColor.border,
                            }}
                          />
                          <span className="text-gray-500 w-6 shrink-0 font-mono text-right">
                            {idx + 1}
                          </span>
                          <span
                            className="w-48 shrink-0 truncate text-xs px-1.5 py-0.5 rounded"
                            style={{ color: catColor.text, background: catColor.bg }}
                          >
                            {step.type}
                          </span>
                          <span className="text-gray-300 truncate">{step.name}</span>
                          {step.durationMs !== undefined && step.type !== 'EVENT_PUBLISHED' && step.type !== 'COMPENSATING_EVENT_PUBLISHED' && (
                            <span className="text-gray-600 ml-auto shrink-0">
                              {formatDuration(step.durationMs)}
                            </span>
                          )}
                          {step.error && (
                            <span className="text-red-400 truncate max-w-xs">{step.error}</span>
                          )}
                          <span className="text-gray-600 ml-1 shrink-0">
                            {expandedStepId === step.stepId ? '\u25BC' : '\u25B6'}
                          </span>
                        </div>
                        {expandedStepId === step.stepId && (
                          <div className="ml-8 mr-2 mb-2 p-4 bg-gray-950 border border-gray-800 rounded-lg text-sm">
                            <StepDetail step={step} />
                          </div>
                        )}
                      </div>
                    );
                  })}
          </div>
        </div>
      )}

      {/* Compensation chain */}
      {compensationSteps.length > 0 && (
        <div className="bg-orange-950/40 border-2 border-orange-500/60 rounded-lg p-5 shadow-lg shadow-orange-900/20">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-orange-500/20 border border-orange-500/40">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-5 h-5 text-orange-400"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-orange-400">Compensation Chain</h2>
              <p className="text-xs text-orange-300/60">
                {compensationSteps.length} rollback steps executed
              </p>
            </div>
          </div>
          <div className="space-y-2 ml-1">
            {compensationSteps.map((step) => (
              <div key={step.stepId} className="flex items-center gap-3 text-sm">
                <StatusDot status={step.error ? 'failed' : 'compensated'} />
                <span className="text-gray-300">{step.name}</span>
                <span className="text-gray-600 text-xs">{step.type}</span>
                {step.error && (
                  <span className="text-red-400 text-xs ml-auto font-medium">
                    MANUAL INTERVENTION REQUIRED: {step.error}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
