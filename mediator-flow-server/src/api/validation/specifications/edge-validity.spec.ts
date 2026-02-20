import type { DiagramSpecification } from '../diagram-specification';
import type { DiagramContext, ValidationIssue } from '../types';

/**
 * The exhaustive list of allowed (source type → target type → edge type) triples.
 * Any edge that doesn't match one of these is illegal.
 */
const ALLOWED_EDGES: { source: string; target: string; edgeType: string }[] = [
  { source: 'command', target: 'handler', edgeType: 'handles' },
  { source: 'query', target: 'handler', edgeType: 'handles' },
  { source: 'handler', target: 'event', edgeType: 'publishes' },
  { source: 'event', target: 'consumer', edgeType: 'consumes' },
  { source: 'consumer', target: 'event', edgeType: 'compensates' },
  { source: 'aggregate', target: 'event', edgeType: 'applies' },
];

function isAllowed(sourceType: string, targetType: string, edgeType: string): boolean {
  return ALLOWED_EDGES.some(
    (a) => a.source === sourceType && a.target === targetType && a.edgeType === edgeType,
  );
}

/**
 * Every edge must connect valid node types with the correct edge type.
 * e.g. consumer → consumer is never valid. command → event is never valid.
 */
export class EdgesMustConnectValidNodeTypes implements DiagramSpecification {
  readonly name = 'edges-connect-valid-types';

  evaluate(ctx: DiagramContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    for (const edge of ctx.edges) {
      const source = ctx.nodeMap.get(edge.source);
      const target = ctx.nodeMap.get(edge.target);

      if (!source || !target) {
        issues.push({
          nodeId: edge.source,
          edgeId: edge.id,
          message: `Edge references a non-existent node`,
          severity: 'error',
          rule: this.name,
        });
        continue;
      }

      if (!isAllowed(source.type, target.type, edge.type)) {
        issues.push({
          nodeId: source.id,
          edgeId: edge.id,
          message: `Invalid connection: ${source.type} "${source.data.name ?? ''}" → ${target.type} "${target.data.name ?? ''}" (edge type "${edge.type}" not allowed between these node types)`,
          severity: 'error',
          rule: this.name,
        });
      }
    }
    return issues;
  }
}

/**
 * Edges must not be self-referencing (source === target).
 */
export class EdgesMustNotSelfReference implements DiagramSpecification {
  readonly name = 'edges-no-self-reference';

  evaluate(ctx: DiagramContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    for (const edge of ctx.edges) {
      if (edge.source === edge.target) {
        issues.push({
          nodeId: edge.source,
          edgeId: edge.id,
          message: `Edge connects a node to itself`,
          severity: 'error',
          rule: this.name,
        });
      }
    }
    return issues;
  }
}

/**
 * No duplicate edges: same source + target + type should not appear twice.
 */
export class EdgesMustNotDuplicate implements DiagramSpecification {
  readonly name = 'edges-no-duplicates';

  evaluate(ctx: DiagramContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const seen = new Set<string>();

    for (const edge of ctx.edges) {
      const key = `${edge.source}|${edge.target}|${edge.type}`;
      if (seen.has(key)) {
        issues.push({
          nodeId: edge.source,
          edgeId: edge.id,
          message: `Duplicate edge from "${ctx.nodeMap.get(edge.source)?.data.name ?? ''}" to "${ctx.nodeMap.get(edge.target)?.data.name ?? ''}"`,
          severity: 'error',
          rule: this.name,
        });
      }
      seen.add(key);
    }
    return issues;
  }
}
