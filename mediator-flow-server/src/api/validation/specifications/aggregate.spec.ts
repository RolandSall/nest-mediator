import type { DiagramSpecification } from '../diagram-specification';
import type { DiagramContext, ValidationIssue } from '../types';

/**
 * An aggregate must have at least one domain event connected via an outgoing "applies" edge.
 */
export class AggregateMustHaveDomainEvents implements DiagramSpecification {
  readonly name = 'aggregate-must-have-domain-events';

  evaluate(ctx: DiagramContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    for (const node of ctx.nodesOfType('aggregate')) {
      const domainEventEdges = ctx.outgoing(node.id, 'applies');
      if (domainEventEdges.length === 0) {
        issues.push({
          nodeId: node.id,
          message: `Aggregate "${node.data.name ?? ''}" has no domain events connected`,
          severity: 'error',
          rule: this.name,
        });
      }
    }
    return issues;
  }
}
