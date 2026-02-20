import type { DiagramContext, ValidationIssue } from './types';

/**
 * Specification pattern for diagram validation.
 *
 * Each specification encapsulates a single business rule.
 * The validator composes them and collects all issues.
 */
export interface DiagramSpecification {
  /** Human-readable name of this rule (used in ValidationIssue.rule) */
  readonly name: string;

  /** Evaluate the diagram against this rule and return any issues found */
  evaluate(ctx: DiagramContext): ValidationIssue[];
}
