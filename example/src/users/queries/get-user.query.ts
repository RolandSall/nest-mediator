import {
  IQuery,
  SkipBehavior,
  PerformanceBehavior,
  LoggingBehavior,
} from '@rolandsall24/nest-mediator';

/**
 * Example: Skip multiple behaviors for this query.
 * This is useful for high-frequency queries where performance tracking
 * and logging would add unnecessary overhead.
 */
@SkipBehavior([PerformanceBehavior, LoggingBehavior])
export class GetUserQuery implements IQuery {
  constructor(public readonly userId: string) {}
}
