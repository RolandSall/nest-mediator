import { Injectable } from '@nestjs/common';
import type { DiagramSpecification } from './diagram-specification';
import { buildContext, type DiagramNode, type DiagramEdge, type ValidationResult } from './types';

// Specifications
import { NodesMustHaveNames, NodeNamesMustBeUniquePerType } from './specifications/node-names.spec';
import {
  EdgesMustConnectValidNodeTypes,
  EdgesMustNotSelfReference,
  EdgesMustNotDuplicate,
} from './specifications/edge-validity.spec';
import {
  CommandQueryMustHaveOneHandler,
  HandlerMustHaveRequest,
  HandlerShouldPublishEvents,
} from './specifications/command-query.spec';
import {
  ConsumerMustHaveEvent,
  CriticalConsumerMustHaveCompensation,
  ConsumerExecutionOrderShouldBeContiguous,
} from './specifications/consumer.spec';
import { EventShouldHaveConsumers, DomainEventMustHaveAggregate } from './specifications/event.spec';
import { AggregateMustHaveDomainEvents } from './specifications/aggregate.spec';
import { BehaviorTargetShouldExist } from './specifications/behavior.spec';

/**
 * Composes all diagram specifications and evaluates them against a graph.
 *
 * Each specification encapsulates a single business rule.
 * The validator collects all issues and partitions them by severity.
 */
@Injectable()
export class DiagramValidator {
  private readonly specifications: DiagramSpecification[] = [
    // Node names
    new NodesMustHaveNames(),
    new NodeNamesMustBeUniquePerType(),

    // Edge structure
    new EdgesMustConnectValidNodeTypes(),
    new EdgesMustNotSelfReference(),
    new EdgesMustNotDuplicate(),

    // Command / Query / Handler relationships
    new CommandQueryMustHaveOneHandler(),
    new HandlerMustHaveRequest(),
    new HandlerShouldPublishEvents(),

    // Consumer rules
    new ConsumerMustHaveEvent(),
    new CriticalConsumerMustHaveCompensation(),
    new ConsumerExecutionOrderShouldBeContiguous(),

    // Event rules
    new EventShouldHaveConsumers(),
    new DomainEventMustHaveAggregate(),

    // Aggregate rules
    new AggregateMustHaveDomainEvents(),

    // Behavior rules
    new BehaviorTargetShouldExist(),
  ];

  validate(nodes: DiagramNode[], edges: DiagramEdge[]): ValidationResult {
    const ctx = buildContext(nodes, edges);

    const errors = [];
    const warnings = [];

    for (const spec of this.specifications) {
      const issues = spec.evaluate(ctx);
      for (const issue of issues) {
        if (issue.severity === 'error') {
          errors.push(issue);
        } else {
          warnings.push(issue);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
