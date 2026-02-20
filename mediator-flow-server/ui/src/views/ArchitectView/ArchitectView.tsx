import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  type Node,
  type Edge,
  type Connection,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import {
  type DiagramNode,
  type DiagramEdge,
  type DiagramNodeData,
  type DiagramNodeType,
  type DiagramGraph,
  getEdgeType,
  getNodeConfig,
  validateDiagram,
  layoutGraph,
  useSaveDiagram,
  useDiagram,
} from '../../diagram';
import { ChatDrawer, useChatStore, type DiagramActions } from '../../ai-chat';

import Palette from './Palette';
import DesignerNode from './DesignerNode';
import NodeConfigPanel from './NodeConfigPanel';
import ValidationOverlay from './ValidationOverlay';
import GenerateModal from './GenerateModal';
import ImportDialog from './ImportDialog';
import DiagramList from './DiagramList';

const nodeTypes = { designer: DesignerNode };

let nodeIdCounter = 0;
function nextNodeId() {
  return `node-${Date.now()}-${nodeIdCounter++}`;
}

function diagramNodeToFlowNode(dn: DiagramNode, validationStatus?: 'valid' | 'error' | 'warning'): Node {
  const config = getNodeConfig(dn.type);
  let subtitle = '';
  if (dn.type === 'consumer' && dn.data.criticality === 'critical') {
    subtitle = `critical, order: ${dn.data.executionOrder ?? 0}`;
  } else if (dn.type === 'behavior') {
    subtitle = `p:${dn.data.priority ?? 0}, ${dn.data.scope ?? 'all'}`;
  }

  return {
    id: dn.id,
    type: 'designer',
    position: dn.position,
    data: {
      ...dn.data,
      nodeType: dn.type,
      subtitle,
      validationStatus,
    },
  };
}

function diagramEdgeToFlowEdge(de: DiagramEdge): Edge {
  const colors: Record<string, string> = {
    handles: '#3b82f6',
    publishes: '#22c55e',
    consumes: '#f59e0b',
    compensates: '#ef4444',
    applies: '#6366f1',
  };
  return {
    id: de.id,
    source: de.source,
    target: de.target,
    label: de.type,
    animated: de.type === 'handles',
    style: { stroke: colors[de.type] ?? '#6b7280' },
    labelStyle: { fill: '#9ca3af', fontSize: 10 },
  };
}

function ArchitectViewInner() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, fitView, setCenter } = useReactFlow();

  // ── Diagram state ──
  const [diagramId, setDiagramId] = useState<string | undefined>();
  const [diagramName, setDiagramName] = useState('Untitled Diagram');
  const [diagramNodes, setDiagramNodes] = useState<DiagramNode[]>([]);
  const [diagramEdges, setDiagramEdges] = useState<DiagramEdge[]>([]);

  // ── UI state ──
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>();
  const [showGenerate, setShowGenerate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showDiagramList, setShowDiagramList] = useState(false);

  // ── Chat state ──
  const { chatOpen, setChatOpen } = useChatStore();
  const diagramNodesRef = useRef(diagramNodes);
  const diagramEdgesRef = useRef(diagramEdges);
  diagramNodesRef.current = diagramNodes;
  diagramEdgesRef.current = diagramEdges;

  const diagramActions = useMemo<DiagramActions>(() => ({
    getNodes: () => diagramNodesRef.current,
    getEdges: () => diagramEdgesRef.current,
    setNodes: (updater) => {
      setDiagramNodes(typeof updater === 'function' ? updater : () => updater);
    },
    setEdges: (updater) => {
      setDiagramEdges(typeof updater === 'function' ? updater : () => updater);
    },
  }), []);

  const saveMutation = useSaveDiagram();
  const { data: loadedDiagram } = useDiagram(diagramId);

  // Load diagram from server when diagramId changes
  useEffect(() => {
    if (loadedDiagram) {
      setDiagramName(loadedDiagram.name);
      setDiagramNodes(loadedDiagram.nodes);
      setDiagramEdges(loadedDiagram.edges);
    }
  }, [loadedDiagram]);

  // ── Validation ──
  const validation = useMemo(
    () => validateDiagram(diagramNodes, diagramEdges),
    [diagramNodes, diagramEdges],
  );

  const nodeValidationMap = useMemo(() => {
    const map = new Map<string, 'valid' | 'error' | 'warning'>();
    for (const e of validation.errors) map.set(e.nodeId, 'error');
    for (const w of validation.warnings) {
      if (!map.has(w.nodeId)) map.set(w.nodeId, 'warning');
    }
    return map;
  }, [validation]);

  // ── Convert to ReactFlow nodes/edges ──
  const flowNodes = useMemo(
    () => diagramNodes.map((dn) => diagramNodeToFlowNode(dn, nodeValidationMap.get(dn.id) ?? 'valid')),
    [diagramNodes, nodeValidationMap],
  );

  const flowEdges = useMemo(
    () => diagramEdges.map(diagramEdgeToFlowEdge),
    [diagramEdges],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  useEffect(() => { setNodes(flowNodes); }, [flowNodes, setNodes]);
  useEffect(() => { setEdges(flowEdges); }, [flowEdges, setEdges]);

  // ── Sync position changes back to diagram state ──
  const onNodesChangeWrapped = useCallback(
    (changes: any) => {
      onNodesChange(changes);
      // Sync position changes
      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          setDiagramNodes((prev) =>
            prev.map((n) => (n.id === change.id ? { ...n, position: change.position } : n)),
          );
        }
      }
    },
    [onNodesChange],
  );

  // ── Drop from palette ──
  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData('application/designer-node-type') as DiagramNodeType;
      if (!type) return;

      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const newNode: DiagramNode = {
        id: nextNodeId(),
        type,
        position,
        data: { name: '' },
      };

      setDiagramNodes((prev) => [...prev, newNode]);
      setSelectedNodeId(newNode.id);
    },
    [screenToFlowPosition],
  );

  // ── Connect nodes ──
  const onConnect = useCallback(
    (connection: Connection) => {
      const sourceNode = diagramNodes.find((n) => n.id === connection.source);
      const targetNode = diagramNodes.find((n) => n.id === connection.target);
      if (!sourceNode || !targetNode) return;

      const edgeType = getEdgeType(sourceNode.type, targetNode.type);
      if (!edgeType) return; // Invalid connection

      const newEdge: DiagramEdge = {
        id: `edge-${Date.now()}-${nodeIdCounter++}`,
        source: connection.source!,
        target: connection.target!,
        type: edgeType,
      };

      setDiagramEdges((prev) => [...prev, newEdge]);
    },
    [diagramNodes],
  );

  // ── Validate connection before allowing ──
  const isValidConnection = useCallback(
    (connection: Edge | Connection) => {
      const sourceNode = diagramNodes.find((n) => n.id === connection.source);
      const targetNode = diagramNodes.find((n) => n.id === connection.target);
      if (!sourceNode || !targetNode) return false;

      const edgeType = getEdgeType(sourceNode.type, targetNode.type);
      if (!edgeType) return false;

      // Command/Query can only have one handler
      if (edgeType === 'handles') {
        const existingHandlerEdge = diagramEdges.find(
          (e) => e.source === connection.source && e.type === 'handles',
        );
        if (existingHandlerEdge) return false;
      }

      return true;
    },
    [diagramNodes, diagramEdges],
  );

  // ── Node click ──
  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const onNodeDoubleClick = useCallback((_: any, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(undefined);
  }, []);

  // ── Update node data from config panel ──
  const updateNodeData = useCallback((id: string, patch: Partial<DiagramNodeData>) => {
    setDiagramNodes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)),
    );
  }, []);

  // ── Delete selected ──
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodeId && !isTyping) {
        setDiagramNodes((prev) => prev.filter((n) => n.id !== selectedNodeId));
        setDiagramEdges((prev) =>
          prev.filter((edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId),
        );
        setSelectedNodeId(undefined);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'g') {
        e.preventDefault();
        setShowGenerate(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        setChatOpen(!chatOpen);
      }
    },
    [selectedNodeId, chatOpen, setChatOpen],
  );

  // ── Save ──
  const handleSave = () => {
    saveMutation.mutate(
      {
        id: diagramId,
        name: diagramName,
        graph: { nodes: diagramNodes, edges: diagramEdges },
      },
      {
        onSuccess: (saved) => {
          setDiagramId(saved.id);
        },
      },
    );
  };

  // ── Import ──
  const handleImport = (graph: DiagramGraph) => {
    const laid = layoutGraph(
      graph.nodes.map((n) => diagramNodeToFlowNode(n as DiagramNode)),
      graph.edges.map((e) => diagramEdgeToFlowEdge(e as DiagramEdge)),
      'LR',
    );
    const importedNodes: DiagramNode[] = graph.nodes.map((n, i) => ({
      ...(n as DiagramNode),
      position: laid.nodes[i]?.position ?? n.position,
    }));
    setDiagramNodes(importedNodes);
    setDiagramEdges(graph.edges as DiagramEdge[]);
    setDiagramId(undefined);
    setDiagramName('Imported Topology');
    setTimeout(() => fitView(), 50);
  };

  // ── New ──
  const handleNew = () => {
    setDiagramNodes([]);
    setDiagramEdges([]);
    setDiagramId(undefined);
    setDiagramName('Untitled Diagram');
    setSelectedNodeId(undefined);
  };

  // ── Navigate to node ──
  const navigateToNode = useCallback(
    (nodeId: string) => {
      const node = diagramNodes.find((n) => n.id === nodeId);
      if (node) {
        setCenter(node.position.x + 80, node.position.y + 30, { zoom: 1.5, duration: 500 });
        setSelectedNodeId(nodeId);
      }
    },
    [diagramNodes, setCenter],
  );

  const selectedDiagramNode = selectedNodeId
    ? diagramNodes.find((n) => n.id === selectedNodeId)
    : undefined;

  const graph: DiagramGraph = { nodes: diagramNodes, edges: diagramEdges };

  return (
    <div
      className="flex h-full"
      onKeyDown={onKeyDown}
      tabIndex={0}
      style={{ outline: 'none' }}
    >
      {/* Palette */}
      <Palette />

      {/* Main area */}
      <div className="flex-1 flex flex-col relative">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-800 bg-gray-900/90 z-10">
          <input
            className="bg-transparent text-sm text-gray-300 font-medium outline-none border-b border-transparent hover:border-gray-600 focus:border-blue-500 px-1"
            value={diagramName}
            onChange={(e) => setDiagramName(e.target.value)}
          />
          <div className="flex-1" />
          <button
            onClick={() => setShowDiagramList(true)}
            className="px-3 py-1 text-xs text-gray-400 hover:text-gray-200 border border-gray-700 rounded"
          >
            Open
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="px-3 py-1 text-xs text-gray-400 hover:text-gray-200 border border-gray-700 rounded"
          >
            Import
          </button>
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="px-3 py-1 text-xs text-gray-400 hover:text-gray-200 border border-gray-700 rounded disabled:opacity-50"
          >
            {saveMutation.isPending ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={() => setShowGenerate(true)}
            className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-500"
          >
            Generate
          </button>
          <button
            onClick={() => setChatOpen(!chatOpen)}
            className={`px-3 py-1 text-xs rounded ${
              chatOpen
                ? 'bg-purple-600 text-white hover:bg-purple-500'
                : 'text-gray-400 hover:text-gray-200 border border-gray-700'
            }`}
            title="Toggle AI Chat (Cmd+/)"
          >
            AI Chat
          </button>
        </div>

        {/* Canvas */}
        <div ref={reactFlowWrapper} className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChangeWrapped}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            isValidConnection={isValidConnection}
            onNodeClick={onNodeClick}
            onNodeDoubleClick={onNodeDoubleClick}
            onPaneClick={onPaneClick}
            onDragOver={onDragOver}
            onDrop={onDrop}
            fitView
            proOptions={{ hideAttribution: true }}
            deleteKeyCode={null} // We handle delete ourselves
          >
            <MiniMap nodeStrokeWidth={3} />
            <Controls />
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1f2937" />
          </ReactFlow>

          {/* Validation bar */}
          <ValidationOverlay
            validation={validation}
            onNavigateToNode={navigateToNode}
          />
        </div>
      </div>

      {/* Right panel: Chat or Config (mutually exclusive) */}
      {chatOpen ? (
        <ChatDrawer
          diagramActions={diagramActions}
          onClose={() => setChatOpen(false)}
        />
      ) : selectedDiagramNode ? (
        <NodeConfigPanel
          node={selectedDiagramNode}
          nodes={diagramNodes}
          onUpdate={updateNodeData}
          onClose={() => setSelectedNodeId(undefined)}
        />
      ) : null}

      {/* Modals */}
      {showGenerate && (
        <GenerateModal
          graph={graph}
          onClose={() => setShowGenerate(false)}
        />
      )}
      {showImport && (
        <ImportDialog
          onImport={handleImport}
          onClose={() => setShowImport(false)}
        />
      )}
      {showDiagramList && (
        <DiagramList
          onLoad={(id) => setDiagramId(id)}
          onNew={handleNew}
          onClose={() => setShowDiagramList(false)}
        />
      )}
    </div>
  );
}

export default function ArchitectView() {
  return (
    <div style={{ height: 'calc(100vh - 120px)' }}>
      <ReactFlowProvider>
        <ArchitectViewInner />
      </ReactFlowProvider>
    </div>
  );
}
