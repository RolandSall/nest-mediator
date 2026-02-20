import type { DiagramSpecification } from '../diagram-specification';
import type { DiagramContext, ValidationIssue } from '../types';

/**
 * Warning: if a behavior specifies a targetType, that command or query
 * should exist on the canvas.
 */
export class BehaviorTargetShouldExist implements DiagramSpecification {
  readonly name = 'behavior-target-should-exist';

  evaluate(ctx: DiagramContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    const commands = ctx.nodesOfType('command');
    const queries = ctx.nodesOfType('query');

    for (const node of ctx.nodesOfType('behavior')) {
      if (!node.data.targetType) continue;

      const targetExists = [...commands, ...queries].some(
        (n) => n.data.name === node.data.targetType,
      );

      if (!targetExists) {
        issues.push({
          nodeId: node.id,
          message: `Behavior "${node.data.name ?? ''}" targets "${node.data.targetType}" which doesn't exist on canvas`,
          severity: 'warning',
          rule: this.name,
        });
      }
    }
    return issues;
  }
}
