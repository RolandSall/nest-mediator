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
import { layoutGraph } from '../../lib/layout';
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
  | 'compensation';

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
  if (t.startsWith('COMPENSATION_') || t === 'COMPENSATING_EVENT_PUBLISHED') return 'compensation';
  if (t === 'COMMAND_DISPATCHED' || t === 'QUERY_DISPATCHED') return 'command';
  if (t === 'BEHAVIOR_ENTERED') return 'behavior';
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

// ─── Compact list builder ─────────────────────────────────────────────────────

function buildCompactList(steps: Step[], hiddenCategories: Set<string>): CompactItem[] {
  const isStartStep = (t: string) =>
    t === 'BEHAVIOR_ENTERED' || t.endsWith('_STARTED') || t.endsWith('_DISPATCHED');
  const isEndStep = (t: string) =>
    t === 'BEHAVIOR_COMPLETED' || t === 'BEHAVIOR_FAILED' ||
    t.endsWith('_COMPLETED') || t.endsWith('_FAILED');
  const isStandalone = (t: string) =>
    t === 'COMMAND_DISPATCHED' || t === 'QUERY_DISPATCHED' ||
    t === 'EVENT_PUBLISHED' || t === 'COMPENSATING_EVENT_PUBLISHED';

  const items: CompactItem[] = [];
  const consumed = new Set<string>();

  for (const step of steps) {
    if (consumed.has(step.stepId)) continue;
    const category = getStepCategory(step);
    if (hiddenCategories.has(category)) continue;

    if (isStandalone(step.type)) {
      consumed.add(step.stepId);
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
  compensation:        { bg: '#78350f', border: '#f59e0b', text: '#fcd34d' },
};

function nodeColors(step: Step): { bg: string; border: string; text: string } {
  const base = categoryColors[getStepCategory(step)];
  return step.error ? { ...base, border: '#ef4444' } : base;
}

const categoryConfig: LegendItem[] = [
  { type: 'command', label: 'Command', color: '#1e3a5f' },
  { type: 'behavior', label: 'Behavior', color: '#581c87' },
  { type: 'handler', label: 'Handler', color: '#14532d' },
  { type: 'event', label: 'Event', color: '#92400e' },
  { type: 'system_consumer', label: 'Sys Consumer', color: '#374151' },
  { type: 'critical_consumer', label: 'Critical', color: '#7f1d1d' },
  { type: 'noncritical_consumer', label: 'Non-Critical', color: '#064e3b' },
  { type: 'compensation', label: 'Compensation', color: '#78350f' },
];

const categoryLabels: Record<StepCategory, string> = {
  command: 'Command', behavior: 'Behavior', handler: 'Handler', event: 'Event',
  system_consumer: 'Sys Consumer', critical_consumer: 'Critical',
  noncritical_consumer: 'Non-Critical', compensation: 'Compensation',
};

// ─── Graph builder ────────────────────────────────────────────────────────────

function estimateWidth(text: string): number {
  return Math.max(160, Math.min(280, text.length * 7 + 32));
}

function itemColors(item: CompactItem): { bg: string; border: string; text: string } {
  const base = categoryColors[item.category];
  return item.error ? { ...base, border: '#ef4444' } : base;
}

function buildExecutionGraph(steps: Step[], hiddenCategories: Set<string>) {
  // Build compact items — each merges STARTED+COMPLETED into a single node
  const items = buildCompactList(steps, hiddenCategories);
  if (items.length === 0) return { nodes: [], edges: [] };

  const itemIdSet = new Set(items.map((it) => it.id));

  // Primary step = first step in the group (the STARTED/ENTERED/DISPATCHED/PUBLISHED one)
  const primaryStep = (item: CompactItem) => item.steps[0];

  // Map eventId → item id for EVENT_PUBLISHED items
  const eventPublishedMap = new Map<string, string>();
  items.forEach((it) => {
    const s = primaryStep(it);
    if (s.eventId && s.type === 'EVENT_PUBLISHED') eventPublishedMap.set(s.eventId, it.id);
  });

  // Map (eventId:name) → item id for consumer/handler items (event-scoped)
  const startedItemMap = new Map<string, string>();
  items.forEach((it) => {
    const s = primaryStep(it);
    if (s.eventId && (s.type.endsWith('_STARTED') || s.type === 'NONCRITICAL_CONSUMER_DISPATCHED')) {
      startedItemMap.set(`${s.eventId}:${s.name}`, it.id);
    }
  });

  // Map name → item id for behaviors/handlers without eventId
  const enteredItemMap = new Map<string, string>();
  items.forEach((it) => {
    const s = primaryStep(it);
    if (!s.eventId && (s.type === 'BEHAVIOR_ENTERED' || s.type === 'COMMAND_HANDLER_STARTED' || s.type === 'QUERY_HANDLER_STARTED')) {
      enteredItemMap.set(s.name, it.id);
    }
  });

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Create one node per compact item
  items.forEach((item) => {
    const colors = itemColors(item);
    const isNonCritical = item.category === 'noncritical_consumer';
    const label = item.durationMs != null
      ? `${item.name}\n${formatDuration(item.durationMs)}`
      : item.name;
    const w = estimateWidth(item.name);

    nodes.push({
      id: item.id,
      type: 'resizable',
      data: {
        label,
        width: w, height: 50, step: primaryStep(item), category: item.category,
        bg: colors.bg, color: colors.text,
        border: `${isNonCritical ? '2px dashed' : '1px solid'} ${colors.border}`,
        borderColor: colors.border, borderRadius: 8,
        fontSize: 10, padding: '6px 10px', whiteSpace: 'pre-line',
        minWidth: 100, minHeight: 40,
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

    // 1. EVENT_PUBLISHED with publishedBy → link to the handler that published it
    if (step.type === 'EVENT_PUBLISHED' && step.metadata?.publishedBy) {
      const publishedBy = step.metadata.publishedBy as string;
      // Try event-scoped lookup (handler within an event consumer context)
      if (step.causationId) {
        const handlerId = startedItemMap.get(`${step.causationId}:${publishedBy}`);
        if (handlerId && itemIdSet.has(handlerId)) {
          edges.push({ id: `e-${handlerId}-${item.id}`, source: handlerId, target: item.id, style: edgeStyle, label: edgeLabel, labelStyle: edgeLabelStyle });
          return;
        }
      }
      // Try name-only lookup (root-level command/query handler)
      const enteredId = enteredItemMap.get(publishedBy);
      if (enteredId && itemIdSet.has(enteredId)) {
        edges.push({ id: `e-${enteredId}-${item.id}`, source: enteredId, target: item.id, style: edgeStyle, label: edgeLabel, labelStyle: edgeLabelStyle });
        return;
      }
    }

    // 2. Consumer/handler STARTED → link to EVENT_PUBLISHED with same eventId
    if (step.eventId && (step.type.endsWith('_STARTED') || step.type === 'NONCRITICAL_CONSUMER_DISPATCHED')) {
      const pubId = eventPublishedMap.get(step.eventId);
      if (pubId && pubId !== item.id && itemIdSet.has(pubId)) {
        edges.push({ id: `e-${pubId}-${item.id}`, source: pubId, target: item.id, style: edgeStyle, label: edgeLabel, labelStyle: edgeLabelStyle });
        return;
      }
    }

    // 3. Cross-event causation fallback → link to parent EVENT_PUBLISHED
    if (step.causationId) {
      const parentId = eventPublishedMap.get(step.causationId);
      if (parentId && itemIdSet.has(parentId)) {
        edges.push({ id: `e-${parentId}-${item.id}`, source: parentId, target: item.id, style: edgeStyle, label: edgeLabel, labelStyle: edgeLabelStyle });
        return;
      }
    }

    // 4. Fallback: sequential link to previous item
    if (i > 0) {
      edges.push({ id: `e-${items[i - 1].id}-${item.id}`, source: items[i - 1].id, target: item.id });
    }
  });

  return layoutGraph(nodes, edges, 'LR');
}

// ─── Node type registration ──────────────────────────────────────────────────

const nodeTypes = { resizable: ResizableNode };

// ─── Component ────────────────────────────────────────────────────────────────

export default function ExecutionView() {
  const { correlationId } = useParams<{ correlationId: string }>();
  const [selectedStep, setSelectedStep] = useState<Step | null>(null);
  const [viewMode, setViewMode] = useState<'flow' | 'sequence'>('flow');
  const [compact, setCompact] = useState(false);
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());
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

  const compactItems = useMemo(() => {
    if (!data?.steps.length) return [];
    return buildCompactList(data.steps, hiddenCategories);
  }, [data, hiddenCategories]);

  const { nodes: layoutNodes, edges: layoutEdges } = useMemo(() => {
    if (!data?.steps.length) return { nodes: [], edges: [] };
    const result = buildExecutionGraph(data.steps, hiddenCategories);

    if (filter) {
      const lower = filter.toLowerCase();
      const matchIds = new Set(
        result.nodes.filter((n) => (n.data.label as string).toLowerCase().includes(lower)).map((n) => n.id),
      );
      return {
        nodes: result.nodes.map((n) => ({ ...n, style: { ...n.style, opacity: matchIds.has(n.id) ? 1 : 0.15 } })),
        edges: result.edges,
      };
    }
    return result;
  }, [data, hiddenCategories, filter]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutEdges);

  useEffect(() => { setNodes(layoutNodes); setEdges(layoutEdges); }, [layoutNodes, layoutEdges, setNodes, setEdges]);

  const onNodeClick = useCallback((_: any, node: Node) => { setSelectedStep(node.data.step as Step); }, []);

  useEffect(() => {
    if (selectedStep && viewMode === 'flow' && detailRef.current)
      detailRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedStep, viewMode]);

  const compensationSteps = data?.steps.filter(
    (s) => s.type.startsWith('COMPENSATION_') || s.type === 'COMPENSATING_EVENT_PUBLISHED',
  ) ?? [];

  if (isLoading) return <div className="text-gray-500">Loading trace...</div>;
  if (!data) return <div className="text-gray-500">Trace not found.</div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link to="/traces" className="text-blue-400 text-sm hover:underline">Back to Traces</Link>
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
          <div className="absolute top-2 left-2 z-10 bg-gray-900/90 border border-gray-700 rounded-lg px-3 py-2">
            <FilterInput value={filter} onChange={setFilter} />
          </div>

          <div className="absolute bottom-2 left-2 z-10 bg-gray-900/90 border border-gray-700 rounded-lg px-3 py-2">
            <CategoryLegend items={categoryConfig} hiddenSet={hiddenCategories} onToggle={toggleCategory} />
          </div>

          <ReactFlow
            nodes={nodes} edges={edges} nodeTypes={nodeTypes}
            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick} fitView proOptions={{ hideAttribution: true }}
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
            <DetailPanel ref={detailRef} title="Step Detail" onClose={() => setSelectedStep(null)}>
              <StepDetail step={selectedStep} />
            </DetailPanel>
          )}
        </div>
      )}

      {/* ─── Sequence mode ─────────────────────────────────────────── */}
      {viewMode === 'sequence' && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 overflow-x-auto">
          <div className="mb-3 flex items-center gap-3">
            <CategoryLegend items={categoryConfig} hiddenSet={hiddenCategories} onToggle={toggleCategory} />
            <button
              onClick={() => setCompact((v) => !v)}
              className={`ml-auto shrink-0 px-2.5 py-1 text-xs rounded border transition-colors ${compact ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-transparent border-gray-700 text-gray-500 hover:text-gray-300'}`}
            >
              Compact
            </button>
          </div>

          <div className="space-y-0">
            {compact
              ? compactItems.map((item, idx) => {
                  const catColor = categoryColors[item.category];
                  return (
                    <div key={item.id}>
                      <div
                        className={`flex items-center gap-3 text-xs py-2 cursor-pointer hover:bg-gray-800/30 px-2 rounded ${expandedCompactId === item.id ? 'bg-gray-800/50' : ''}`}
                        onClick={() => setExpandedCompactId(expandedCompactId === item.id ? null : item.id)}
                      >
                        <span className="text-gray-500 w-6 shrink-0 font-mono text-right">{idx + 1}</span>
                        <StatusDot status={item.status} />
                        <span className="w-24 shrink-0 text-xs text-center px-1.5 py-0.5 rounded" style={{ color: catColor.text, background: catColor.bg }}>
                          {categoryLabels[item.category]}
                        </span>
                        <span className="text-gray-300 truncate">{item.name}</span>
                        {item.durationMs !== undefined && (
                          <span className="text-gray-600 ml-auto shrink-0">{formatDuration(item.durationMs)}</span>
                        )}
                        {item.error && <span className="text-red-400 truncate max-w-xs">{item.error}</span>}
                        <span className="text-gray-600 ml-1 shrink-0">{expandedCompactId === item.id ? '\u25BC' : '\u25B6'}</span>
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
                })
              : data.steps.filter((s) => !hiddenCategories.has(getStepCategory(s))).map((step, idx) => {
                  const catColor = categoryColors[getStepCategory(step)];
                  return (
                    <div key={step.stepId}>
                      <div
                        className={`flex items-center gap-3 text-xs py-2 cursor-pointer hover:bg-gray-800/30 px-2 rounded ${expandedStepId === step.stepId ? 'bg-gray-800/50' : ''}`}
                        onClick={() => setExpandedStepId(expandedStepId === step.stepId ? null : step.stepId)}
                      >
                        <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: step.error ? '#ef4444' : catColor.border }} />
                        <span className="text-gray-500 w-6 shrink-0 font-mono text-right">{idx + 1}</span>
                        <span className="w-48 shrink-0 truncate text-xs px-1.5 py-0.5 rounded" style={{ color: catColor.text, background: catColor.bg }}>{step.type}</span>
                        <span className="text-gray-300 truncate">{step.name}</span>
                        {step.durationMs !== undefined && (
                          <span className="text-gray-600 ml-auto shrink-0">{formatDuration(step.durationMs)}</span>
                        )}
                        {step.error && <span className="text-red-400 truncate max-w-xs">{step.error}</span>}
                        <span className="text-gray-600 ml-1 shrink-0">{expandedStepId === step.stepId ? '\u25BC' : '\u25B6'}</span>
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
        <div className="bg-gray-900 border border-orange-900/50 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-orange-400 mb-3">
            Compensation Chain ({compensationSteps.length} steps)
          </h2>
          <div className="space-y-2">
            {compensationSteps.map((step) => (
              <div key={step.stepId} className="flex items-center gap-3 text-sm">
                <StatusDot status={step.error ? 'failed' : 'compensated'} />
                <span className="text-gray-300">{step.name}</span>
                <span className="text-gray-600 text-xs">{step.type}</span>
                {step.error && (
                  <span className="text-red-400 text-xs ml-auto">
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
