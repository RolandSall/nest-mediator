import 'reflect-metadata';

/**
 * Metadata key for the @ForAggregate decorator.
 * Stores the aggregate class on the repository so that AggregateRepository
 * can derive aggregateType, createEmptyAggregate, and deserializeEvent automatically.
 */
export const AGGREGATE_CLASS_METADATA = Symbol('AGGREGATE_CLASS_METADATA');

/**.
 *
 * @param aggregateClass - The aggregate root class (e.g., OrderAggregate)
 *
 * @example
 * ```typescript
 * @Injectable()
 * @ForAggregate(OrderAggregate)
 * export class OrderAggregateRepository
 *   extends AggregateRepository<OrderAggregate, string> {}
 * ```
 */
export function ForAggregate(aggregateClass: Function): ClassDecorator {
  return (target: Function) => {
    Reflect.defineMetadata(AGGREGATE_CLASS_METADATA, aggregateClass, target);
  };
}
