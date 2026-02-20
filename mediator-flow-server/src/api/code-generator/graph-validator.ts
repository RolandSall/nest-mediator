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

interface ValidationIssue {
  nodeId: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export function validateGraph(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  const outgoing = (nodeId: string, edgeType?: string) =>
    edges.filter((e) => e.source === nodeId && (!edgeType || e.type === edgeType));

  const incoming = (nodeId: string, edgeType?: string) =>
    edges.filter((e) => e.target === nodeId && (!edgeType || e.type === edgeType));

  // Track names per type for duplicate detection
  const namesByType = new Map<string, Map<string, string>>();

  for (const node of nodes) {
    const name = node.data.name;
    if (!name || !name.trim()) {
      errors.push({ nodeId: node.id, message: `${node.type} node is missing a name` });
      continue;
    }

    const typeMap = namesByType.get(node.type) ?? new Map<string, string>();
    const existing = typeMap.get(name);
    if (existing) {
      errors.push({
        nodeId: node.id,
        message: `Duplicate ${node.type} name "${name}" (also used by another node)`,
      });
    } else {
      typeMap.set(name, node.id);
      namesByType.set(node.type, typeMap);
    }
  }

  for (const node of nodes) {
    switch (node.type) {
      case 'command':
      case 'query': {
        const handlerEdges = outgoing(node.id, 'handles');
        if (handlerEdges.length === 0) {
          errors.push({
            nodeId: node.id,
            message: `${node.type} "${node.data.name}" has no handler connected`,
          });
        } else if (handlerEdges.length > 1) {
          errors.push({
            nodeId: node.id,
            message: `${node.type} "${node.data.name}" has multiple handlers — only one is allowed`,
          });
        }
        break;
      }

      case 'handler': {
        const requestEdges = incoming(node.id, 'handles');
        if (requestEdges.length === 0) {
          errors.push({
            nodeId: node.id,
            message: `Handler "${node.data.name}" is not connected to any command or query`,
          });
        }
        const publishEdges = outgoing(node.id, 'publishes');
        if (publishEdges.length === 0) {
          warnings.push({
            nodeId: node.id,
            message: `Handler "${node.data.name}" doesn't publish any events (terminal handler)`,
          });
        }
        break;
      }

      case 'event': {
        const consumers = outgoing(node.id, 'consumes');
        if (consumers.length === 0) {
          warnings.push({
            nodeId: node.id,
            message: `Event "${node.data.name}" has no consumers`,
          });
        }
        if (node.data.isDomainEvent) {
          const aggregateEdges = incoming(node.id, 'applies');
          if (aggregateEdges.length === 0) {
            errors.push({
              nodeId: node.id,
              message: `Domain event "${node.data.name}" is not connected to an aggregate`,
            });
          }
        }
        break;
      }

      case 'consumer': {
        const eventEdges = incoming(node.id, 'consumes');
        if (eventEdges.length === 0) {
          errors.push({
            nodeId: node.id,
            message: `Consumer "${node.data.name}" is not connected to any event`,
          });
        }
        if (node.data.criticality === 'critical') {
          const compEdges = outgoing(node.id, 'compensates');
          if (compEdges.length === 0) {
            errors.push({
              nodeId: node.id,
              message: `Critical consumer "${node.data.name}" has no compensation event`,
            });
          }
        }
        break;
      }

      case 'behavior': {
        if (node.data.targetType) {
          const matchingNode = nodes.find(
            (n) =>
              (n.type === 'command' || n.type === 'query') &&
              n.data.name === node.data.targetType,
          );
          if (!matchingNode) {
            warnings.push({
              nodeId: node.id,
              message: `Behavior "${node.data.name}" targets "${node.data.targetType}" which doesn't exist on canvas`,
            });
          }
        }
        break;
      }

      case 'aggregate': {
        const domainEventEdges = outgoing(node.id, 'applies');
        if (domainEventEdges.length === 0) {
          errors.push({
            nodeId: node.id,
            message: `Aggregate "${node.data.name}" has no domain events connected`,
          });
        }
        break;
      }
    }
  }

  // Check consumer execution order gaps within the same event
  const eventConsumersMap = new Map<string, { order: number; nodeId: string; name: string }[]>();
  for (const edge of edges) {
    if (edge.type !== 'consumes') continue;
    const consumerNode = nodeMap.get(edge.target);
    if (!consumerNode || consumerNode.data.criticality !== 'critical') continue;
    const list = eventConsumersMap.get(edge.source) ?? [];
    list.push({
      order: consumerNode.data.executionOrder ?? 0,
      nodeId: consumerNode.id,
      name: consumerNode.data.name,
    });
    eventConsumersMap.set(edge.source, list);
  }

  for (const [, consumers] of eventConsumersMap) {
    if (consumers.length <= 1) continue;
    const orders = consumers.map((c) => c.order).sort((a, b) => a - b);
    for (let i = 1; i < orders.length; i++) {
      if (orders[i] - orders[i - 1] > 1) {
        warnings.push({
          nodeId: consumers[0].nodeId,
          message: `Critical consumers have execution order gap (${orders.join(', ')})`,
        });
        break;
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
