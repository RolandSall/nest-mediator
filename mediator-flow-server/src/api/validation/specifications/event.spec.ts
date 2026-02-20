import type { DiagramSpecification } from '../diagram-specification';
import type { DiagramContext, ValidationIssue } from '../types';

/**
 * Warning: an event with no consumers may be intentional,
 * but is likely a diagram that's not fully wired up.
 */
export class EventShouldHaveConsumers implements DiagramSpecification {
  readonly name = 'event-should-have-consumers';

  evaluate(ctx: DiagramContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    for (const node of ctx.nodesOfType('event')) {
      const consumers = ctx.outgoing(node.id, 'consumes');
      if (consumers.length === 0) {
        issues.push({
          nodeId: node.id,
          message: `Event "${node.data.name ?? ''}" has no consumers`,
          severity: 'warning',
          rule: this.name,
        });
      }
    }
    return issues;
  }
}

/**
 * A domain event (isDomainEvent === true) must be connected to an aggregate
 * via an incoming "applies" edge.
 */
export class DomainEventMustHaveAggregate implements DiagramSpecification {
  readonly name = 'domain-event-must-have-aggregate';

  evaluate(ctx: DiagramContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    for (const node of ctx.nodesOfType('event')) {
      if (!node.data.isDomainEvent) continue;

      const aggregateEdges = ctx.incoming(node.id, 'applies');
      if (aggregateEdges.length === 0) {
        issues.push({
          nodeId: node.id,
          message: `Domain event "${node.data.name ?? ''}" is not connected to an aggregate`,
          severity: 'error',
          rule: this.name,
        });
      }
    }
    return issues;
  }
}
