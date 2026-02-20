import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  type Node,
  type Edge,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { api, Topology } from '../../lib/api';
import { layoutGraph } from '../../diagram';
import { useUIStore } from '../../stores/uiStore';
import ResizableNode from '../../components/ResizableNode';
import CategoryLegend, { type LegendItem } from '../../components/CategoryLegend';
import FilterInput from '../../components/FilterInput';
import DetailPanel from '../../components/DetailPanel';

type NodeType = 'command' | 'query' | 'event' | 'consumer' | 'behavior' | 'handler';

const nodeTypes = { resizable: ResizableNode };

function estimateWidth(text: string): number {
  return Math.max(160, text.length * 7.5 + 32);
}

function makeNode(id: string, label: string, width: number, nodeType: string, serviceName: string, bg: string, color: string, borderColor: string, borderRadius = 8): Node {
  return {
    id,
    type: 'resizable',
    data: { label, width, height: 40, nodeType, serviceName, bg, color, border: `1px solid ${borderColor}`, borderColor, borderRadius },
    position: { x: 0, y: 0 },
    style: { width, height: 40 },
  };
}

function buildTopologyGraph(topology: Topology) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  let id = 0;

  for (const cmd of topology.commands) {
    const cmdId = `cmd-${id++}`;
    const handlerId = `handler-${id++}`;
    nodes.push(makeNode(cmdId, cmd.commandName, estimateWidth(cmd.commandName), 'command', cmd.serviceName, '#1e40af', '#fff', '#3b82f6'));
    nodes.push(makeNode(handlerId, cmd.handlerName, estimateWidth(cmd.handlerName), 'handler', cmd.serviceName, '#374151', '#d1d5db', '#4b5563'));
    edges.push({ id: `e-${cmdId}-${handlerId}`, source: cmdId, target: handlerId, animated: true });
  }

  for (const q of topology.queries) {
    const qId = `qry-${id++}`;
    const handlerId = `handler-${id++}`;
    nodes.push(makeNode(qId, q.queryName, estimateWidth(q.queryName), 'query', q.serviceName, '#065f46', '#fff', '#10b981'));
    nodes.push(makeNode(handlerId, q.handlerName, estimateWidth(q.handlerName), 'handler', q.serviceName, '#374151', '#d1d5db', '#4b5563'));
    edges.push({ id: `e-${qId}-${handlerId}`, source: qId, target: handlerId });
  }

  for (const evt of topology.events) {
    const evtId = `evt-${id++}`;
    nodes.push(makeNode(evtId, evt.eventName, estimateWidth(evt.eventName), 'event', evt.serviceName, '#92400e', '#fff', '#f59e0b'));

    for (const c of evt.consumers) {
      const cId = `consumer-${id++}`;
      const isCritical = c.criticality === 'critical';
      const label = `${c.consumerName}${c.hasCompensation ? ' [C]' : ''}`;
      nodes.push(makeNode(cId, label, estimateWidth(label), 'consumer', evt.serviceName, isCritical ? '#7f1d1d' : '#374151', isCritical ? '#fca5a5' : '#d1d5db', isCritical ? '#ef4444' : '#4b5563'));
      edges.push({ id: `e-${evtId}-${cId}`, source: evtId, target: cId });
    }
  }

  for (const b of topology.behaviors) {
    const bId = `beh-${id++}`;
    const label = `${b.behaviorName} (p:${b.priority})`;
    nodes.push(makeNode(bId, label, estimateWidth(label), 'behavior', b.serviceName, '#581c87', '#e9d5ff', '#a855f7', 20));
  }

  return layoutGraph(nodes, edges, 'LR');
}

const legendItems: LegendItem[] = [
  { type: 'command', label: 'Command', color: '#1e40af' },
  { type: 'handler', label: 'Handler', color: '#374151' },
  { type: 'query', label: 'Query', color: '#065f46' },
  { type: 'event', label: 'Event', color: '#92400e' },
  { type: 'consumer', label: 'Consumer', color: '#7f1d1d' },
  { type: 'behavior', label: 'Behavior', color: '#581c87', rounded: true },
];

export default function TopologyView() {
  const { selectedService, setSelectedService, selectedNodeId, setSelectedNodeId } = useUIStore();

  const { data: allTopology } = useQuery({
    queryKey: ['topology'],
    queryFn: () => api.getTopology(),
  });

  const serviceNames = useMemo(() => {
    if (!allTopology?.services) return [];
    const names = [...new Set(allTopology.services.map((s: any) => s.service_name))];
    return names.sort();
  }, [allTopology]);

  const { data: topology, isLoading } = useQuery({
    queryKey: ['topology', selectedService],
    queryFn: () => api.getTopology(selectedService),
  });

  const [filter, setFilter] = useState('');
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());

  const toggleType = useCallback((type: string) => {
    setHiddenTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const { nodes: layoutNodes, edges: layoutEdges } = useMemo(() => {
    if (!topology) return { nodes: [], edges: [] };
    const result = buildTopologyGraph(topology);

    const visibleIds = new Set<string>();
    let filtered = result.nodes;
    if (hiddenTypes.size > 0) {
      filtered = result.nodes.filter((n) => {
        const visible = !hiddenTypes.has(n.data.nodeType as NodeType);
        if (visible) visibleIds.add(n.id);
        return visible;
      });
    } else {
      result.nodes.forEach((n) => visibleIds.add(n.id));
    }

    const filteredEdges = result.edges.filter(
      (e) => visibleIds.has(e.source) && visibleIds.has(e.target),
    );

    const reLayout = hiddenTypes.size > 0
      ? layoutGraph(filtered, filteredEdges, 'LR')
      : { nodes: filtered, edges: filteredEdges };

    if (filter) {
      const lower = filter.toLowerCase();
      const matchIds = new Set(
        reLayout.nodes
          .filter((n) => (n.data.label as string).toLowerCase().includes(lower))
          .map((n) => n.id),
      );
      return {
        nodes: reLayout.nodes.map((n) => ({
          ...n,
          style: { ...n.style, opacity: matchIds.has(n.id) ? 1 : 0.15 },
        })),
        edges: reLayout.edges,
      };
    }

    return reLayout;
  }, [topology, filter, hiddenTypes]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutEdges);

  useEffect(() => {
    setNodes(layoutNodes);
    setEdges(layoutEdges);
  }, [layoutNodes, layoutEdges, setNodes, setEdges]);

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNodeId(node.id);
  }, [setSelectedNodeId]);

  if (isLoading) return <div className="text-gray-500">Loading topology...</div>;

  return (
    <div className="relative" style={{ height: 'calc(100vh - 120px)' }}>
      {/* Filter bar */}
      <div className="absolute top-2 left-2 z-10 bg-gray-900/90 border border-gray-700 rounded-lg px-3 py-2 flex items-center gap-3">
        {serviceNames.length > 1 && (
          <select
            value={selectedService ?? ''}
            onChange={(e) => setSelectedService(e.target.value || undefined)}
            className="bg-gray-800 text-sm text-gray-300 border border-gray-600 rounded px-2 py-1 outline-none"
          >
            <option value="">All services</option>
            {serviceNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        )}
        <FilterInput value={filter} onChange={setFilter} />
      </div>

      {/* Clickable legend */}
      <div className="absolute bottom-2 left-2 z-10 bg-gray-900/90 border border-gray-700 rounded-lg px-3 py-2">
        <CategoryLegend items={legendItems} hiddenSet={hiddenTypes} onToggle={toggleType} />
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
        <MiniMap nodeStrokeWidth={3} />
        <Controls />
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1f2937" />
      </ReactFlow>

      {/* Detail panel */}
      {selectedNodeId && (
        <DetailPanel title="Node Details" onClose={() => setSelectedNodeId(undefined)}>
          {(() => {
            const node = nodes.find((n) => n.id === selectedNodeId);
            if (!node) return <p className="text-gray-500">Not found</p>;
            return (
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-gray-500">Type: </span>
                  <span className="text-gray-300">{node.data.nodeType as string}</span>
                </div>
                <div>
                  <span className="text-gray-500">Name: </span>
                  <span className="text-gray-200">{node.data.label as string}</span>
                </div>
                {node.data.serviceName ? (
                  <div>
                    <span className="text-gray-500">Service: </span>
                    <span className="text-gray-300">{String(node.data.serviceName)}</span>
                  </div>
                ) : null}
              </div>
            );
          })()}
        </DetailPanel>
      )}
    </div>
  );
}
