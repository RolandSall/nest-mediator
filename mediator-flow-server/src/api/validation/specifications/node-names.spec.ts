import type { DiagramSpecification } from '../diagram-specification';
import type { DiagramContext, ValidationIssue } from '../types';

/**
 * Every node must have a non-empty name.
 */
export class NodesMustHaveNames implements DiagramSpecification {
  readonly name = 'nodes-must-have-names';

  evaluate(ctx: DiagramContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    for (const node of ctx.nodes) {
      if (!node.data.name || !String(node.data.name).trim()) {
        issues.push({
          nodeId: node.id,
          message: `${node.type} node is missing a name`,
          severity: 'error',
          rule: this.name,
        });
      }
    }
    return issues;
  }
}

/**
 * No two nodes of the same type may share the same name.
 */
export class NodeNamesMustBeUniquePerType implements DiagramSpecification {
  readonly name = 'node-names-unique-per-type';

  evaluate(ctx: DiagramContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const seen = new Map<string, Map<string, string>>(); // type → name → first nodeId

    for (const node of ctx.nodes) {
      const nodeName = node.data.name;
      if (!nodeName) continue;

      const typeMap = seen.get(node.type) ?? new Map();
      if (typeMap.has(nodeName)) {
        issues.push({
          nodeId: node.id,
          message: `Duplicate ${node.type} name "${nodeName}"`,
          severity: 'error',
          rule: this.name,
        });
      } else {
        typeMap.set(nodeName, node.id);
        seen.set(node.type, typeMap);
      }
    }
    return issues;
  }
}
