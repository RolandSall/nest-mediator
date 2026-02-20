import type { DiagramSpecification } from '../diagram-specification';
import type { DiagramContext, ValidationIssue } from '../types';

/**
 * Every command or query must have exactly one handler (1:1 via "handles" edge).
 */
export class CommandQueryMustHaveOneHandler implements DiagramSpecification {
  readonly name = 'command-query-must-have-one-handler';

  evaluate(ctx: DiagramContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    for (const node of [...ctx.nodesOfType('command'), ...ctx.nodesOfType('query')]) {
      const handlerEdges = ctx.outgoing(node.id, 'handles');

      if (handlerEdges.length === 0) {
        issues.push({
          nodeId: node.id,
          message: `${node.type} "${node.data.name ?? ''}" has no handler connected`,
          severity: 'error',
          rule: this.name,
        });
      } else if (handlerEdges.length > 1) {
        issues.push({
          nodeId: node.id,
          message: `${node.type} "${node.data.name ?? ''}" has multiple handlers — only one is allowed`,
          severity: 'error',
          rule: this.name,
        });
      }
    }
    return issues;
  }
}

/**
 * Every handler must be connected to a command or query via an incoming "handles" edge.
 */
export class HandlerMustHaveRequest implements DiagramSpecification {
  readonly name = 'handler-must-have-request';

  evaluate(ctx: DiagramContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    for (const node of ctx.nodesOfType('handler')) {
      const requestEdges = ctx.incoming(node.id, 'handles');
      if (requestEdges.length === 0) {
        issues.push({
          nodeId: node.id,
          message: `Handler "${node.data.name ?? ''}" is not connected to any command or query`,
          severity: 'error',
          rule: this.name,
        });
      }
    }
    return issues;
  }
}

/**
 * Warning: a handler that publishes no events is a terminal handler.
 * Not necessarily wrong, but worth flagging.
 */
export class HandlerShouldPublishEvents implements DiagramSpecification {
  readonly name = 'handler-should-publish-events';

  evaluate(ctx: DiagramContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    for (const node of ctx.nodesOfType('handler')) {
      const publishEdges = ctx.outgoing(node.id, 'publishes');
      if (publishEdges.length === 0) {
        issues.push({
          nodeId: node.id,
          message: `Handler "${node.data.name ?? ''}" doesn't publish any events (terminal handler)`,
          severity: 'warning',
          rule: this.name,
        });
      }
    }
    return issues;
  }
}
