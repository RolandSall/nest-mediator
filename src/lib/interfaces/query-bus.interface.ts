import { Type } from '@nestjs/common';
import { IQuery } from './query.interface.js';
import { IQueryHandler } from './query-handler.interface.js';

/**
 * Interface for the query bus.
 * Responsible for dispatching queries to their handlers.
 */
export interface IQueryBus {
  /**
   * Execute a query through its handler
   * @param query - The query instance
   * @returns Promise with the result
   */
  query<TQuery extends IQuery, TResult = any>(query: TQuery): Promise<TResult>;

  /**
   * Register a query handler
   * @param query - The query class
   * @param handler - The handler class
   */
  registerQueryHandler(
    query: Type<IQuery>,
    handler: Type<IQueryHandler<any, any>>
  ): void;

  /**
   * Get registered query names (for debugging)
   */
  getRegisteredQueries(): string[];
}
