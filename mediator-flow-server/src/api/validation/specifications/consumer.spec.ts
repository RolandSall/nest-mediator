import type { DiagramSpecification } from '../diagram-specification';
import type { DiagramContext, ValidationIssue } from '../types';

/**
 * Every consumer must be connected to at least one event via an incoming "consumes" edge.
 */
export class ConsumerMustHaveEvent implements DiagramSpecification {
  readonly name = 'consumer-must-have-event';

  evaluate(ctx: DiagramContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    for (const node of ctx.nodesOfType('consumer')) {
      const eventEdges = ctx.incoming(node.id, 'consumes');
      if (eventEdges.length === 0) {
        issues.push({
          nodeId: node.id,
          message: `Consumer "${node.data.name ?? ''}" is not connected to any event`,
          severity: 'error',
          rule: this.name,
        });
      }
    }
    return issues;
  }
}

/**
 * A critical consumer must have a compensation event via an outgoing "compensates" edge.
 */
export class CriticalConsumerMustHaveCompensation implements DiagramSpecification {
  readonly name = 'critical-consumer-must-have-compensation';

  evaluate(ctx: DiagramContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    for (const node of ctx.nodesOfType('consumer')) {
      if (node.data.criticality !== 'critical') continue;

      const compEdges = ctx.outgoing(node.id, 'compensates');
      if (compEdges.length === 0) {
        issues.push({
          nodeId: node.id,
          message: `Critical consumer "${node.data.name ?? ''}" has no compensation event`,
          severity: 'error',
          rule: this.name,
        });
      }
    }
    return issues;
  }
}

/**
 * Warning: critical consumers for the same event should have contiguous execution orders.
 * Gaps may indicate misconfiguration.
 */
export class ConsumerExecutionOrderShouldBeContiguous implements DiagramSpecification {
  readonly name = 'consumer-execution-order-contiguous';

  evaluate(ctx: DiagramContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Group critical consumers by their source event
    const eventConsumers = new Map<string, { order: number; nodeId: string; name: string }[]>();

    for (const edge of ctx.edges) {
      if (edge.type !== 'consumes') continue;
      const consumer = ctx.nodeMap.get(edge.target);
      if (!consumer || consumer.data.criticality !== 'critical') continue;

      const list = eventConsumers.get(edge.source) ?? [];
      list.push({
        order: consumer.data.executionOrder ?? 0,
        nodeId: consumer.id,
        name: consumer.data.name ?? '',
      });
      eventConsumers.set(edge.source, list);
    }

    for (const [eventId, consumers] of eventConsumers) {
      if (consumers.length <= 1) continue;
      const orders = consumers.map((c) => c.order).sort((a, b) => a - b);

      for (let i = 1; i < orders.length; i++) {
        if (orders[i] - orders[i - 1] > 1) {
          const eventNode = ctx.nodeMap.get(eventId);
          issues.push({
            nodeId: consumers[0].nodeId,
            message: `Critical consumers for event "${eventNode?.data.name ?? ''}" have execution order gap (${orders.join(', ')})`,
            severity: 'warning',
            rule: this.name,
          });
          break;
        }
      }
    }
    return issues;
  }
}
