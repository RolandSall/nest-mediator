import { IQuery } from './query.interface.js';

/**
 * Interface for query handlers
 * @template TQuery - The query type that extends IQuery
 * @template TResult - The result type (default: any)
 */
export interface IQueryHandler<TQuery extends IQuery, TResult = any> {
  /**
   * Execute the query
   * @param query - The query to execute
   * @returns Promise with the result
   */
  execute(query: TQuery): Promise<TResult>;
}
