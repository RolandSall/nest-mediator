import {
  toKebab,
  commandTemplate,
  commandHandlerTemplate,
  queryTemplate,
  queryHandlerTemplate,
  eventTemplate,
  nonCriticalConsumerTemplate,
  criticalConsumerTemplate,
  behaviorTemplate,
  aggregateTemplate,
  aggregateRepositoryTemplate,
} from './templates';

interface DiagramNode {
  id: string;
  type: string;
  data: Record<string, any>;
}

interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  type: string;
}

export interface GeneratedFile {
  path: string;
  content: string;
}

export interface GenerationSummary {
  commands: number;
  queries: number;
  events: number;
  consumers: number;
  behaviors: number;
  aggregates: number;
  totalFiles: number;
}

export interface GenerationResult {
  files: GeneratedFile[];
  tree: string;
  summary: GenerationSummary;
}

export function buildFiles(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
): GenerationResult {
  const files: GeneratedFile[] = [];
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  const summary: GenerationSummary = {
    commands: 0,
    queries: 0,
    events: 0,
    consumers: 0,
    behaviors: 0,
    aggregates: 0,
    totalFiles: 0,
  };

  const outgoing = (nodeId: string, edgeType: string) =>
    edges.filter((e) => e.source === nodeId && e.type === edgeType);

  const incoming = (nodeId: string, edgeType: string) =>
    edges.filter((e) => e.target === nodeId && e.type === edgeType);

  // ── Events (generate first since others reference them) ──

  for (const node of nodes.filter((n) => n.type === 'event')) {
    const name = node.data.name;
    const fields = node.data.fields ?? [];
    const domainEvent =
      node.data.isDomainEvent && node.data.aggregateType && node.data.aggregateIdField
        ? { aggregateType: node.data.aggregateType, aggregateIdField: node.data.aggregateIdField }
        : undefined;

    files.push({
      path: `src/domain/events/${toKebab(name)}.event.ts`,
      content: eventTemplate(name, fields, domainEvent),
    });
    summary.events++;
  }

  // ── Commands + Handlers ──

  for (const node of nodes.filter((n) => n.type === 'command')) {
    const name = node.data.name;
    const fields = node.data.fields ?? [];
    const domain = toKebab(name);

    files.push({
      path: `src/application/${domain}/${domain}.command.ts`,
      content: commandTemplate(name, fields),
    });
    summary.commands++;

    // Find handler
    const handlerEdges = outgoing(node.id, 'handles');
    if (handlerEdges.length > 0) {
      const handlerNode = nodeMap.get(handlerEdges[0].target);
      const deps = handlerNode?.data.dependencies ?? [];
      files.push({
        path: `src/application/${domain}/${domain}.handler.ts`,
        content: commandHandlerTemplate(name, deps),
      });
    }
  }

  // ── Queries + Handlers ──

  for (const node of nodes.filter((n) => n.type === 'query')) {
    const name = node.data.name;
    const fields = node.data.fields ?? [];
    const returnType = node.data.returnType ?? 'any';
    const domain = toKebab(name);

    files.push({
      path: `src/application/${domain}/${domain}.query.ts`,
      content: queryTemplate(name, fields, returnType),
    });
    summary.queries++;

    const handlerEdges = outgoing(node.id, 'handles');
    if (handlerEdges.length > 0) {
      const handlerNode = nodeMap.get(handlerEdges[0].target);
      const deps = handlerNode?.data.dependencies ?? [];
      files.push({
        path: `src/application/${domain}/${domain}.query-handler.ts`,
        content: queryHandlerTemplate(name, returnType, deps),
      });
    }
  }

  // ── Consumers ──

  for (const node of nodes.filter((n) => n.type === 'consumer')) {
    const name = node.data.name;
    const eventEdges = incoming(node.id, 'consumes');
    if (eventEdges.length === 0) continue;

    const eventNode = nodeMap.get(eventEdges[0].source);
    if (!eventNode) continue;
    const eventName = eventNode.data.name;

    if (node.data.criticality === 'critical') {
      const order = node.data.executionOrder ?? 0;
      // Find compensation event
      const compEdges = outgoing(node.id, 'compensates');
      const compEventNode = compEdges.length > 0 ? nodeMap.get(compEdges[0].target) : undefined;
      const compEventName = compEventNode?.data.name;

      files.push({
        path: `src/event-handlers/${toKebab(name)}.consumer.ts`,
        content: criticalConsumerTemplate(name, eventName, order, compEventName),
      });
    } else {
      files.push({
        path: `src/event-handlers/${toKebab(name)}.consumer.ts`,
        content: nonCriticalConsumerTemplate(name, eventName),
      });
    }
    summary.consumers++;
  }

  // ── Behaviors ──

  for (const node of nodes.filter((n) => n.type === 'behavior')) {
    const name = node.data.name;
    const priority = node.data.priority ?? 0;
    const scope = node.data.scope ?? 'all';
    const targetType = node.data.targetType;

    files.push({
      path: `src/behaviors/${toKebab(name)}.behavior.ts`,
      content: behaviorTemplate(name, priority, scope, targetType),
    });
    summary.behaviors++;
  }

  // ── Aggregates ──

  for (const node of nodes.filter((n) => n.type === 'aggregate')) {
    const name = node.data.name;
    const idType = node.data.idType ?? 'string';
    const stateFields = node.data.stateFields ?? [];

    // Find connected domain events
    const applyEdges = outgoing(node.id, 'applies');
    const eventNames = applyEdges
      .map((e) => nodeMap.get(e.target))
      .filter(Boolean)
      .map((n) => n!.data.name);

    files.push({
      path: `src/domain/entities/${toKebab(name)}.aggregate.ts`,
      content: aggregateTemplate(name, idType, stateFields, eventNames),
    });

    files.push({
      path: `src/infrastructure/persistence/${toKebab(name)}-aggregate.repository.ts`,
      content: aggregateRepositoryTemplate(name, idType),
    });
    summary.aggregates++;
  }

  summary.totalFiles = files.length;

  // Build ASCII tree
  const tree = buildAsciiTree(files.map((f) => f.path));

  return { files, tree, summary };
}

function buildAsciiTree(paths: string[]): string {
  const sorted = [...paths].sort();
  const lines: string[] = [];

  interface TreeNode {
    children: Map<string, TreeNode>;
  }

  const root: TreeNode = { children: new Map() };

  for (const p of sorted) {
    const parts = p.split('/');
    let current = root;
    for (const part of parts) {
      if (!current.children.has(part)) {
        current.children.set(part, { children: new Map() });
      }
      current = current.children.get(part)!;
    }
  }

  function render(node: TreeNode, prefix: string, isLast: boolean, name: string) {
    if (name) {
      lines.push(`${prefix}${isLast ? '└── ' : '├── '}${name}`);
    }
    const entries = [...node.children.entries()];
    entries.forEach(([childName, child], i) => {
      const childIsLast = i === entries.length - 1;
      const newPrefix = name ? `${prefix}${isLast ? '    ' : '│   '}` : prefix;
      render(child, newPrefix, childIsLast, childName);
    });
  }

  render(root, '', true, '');

  return lines.join('\n');
}
