import { SetMetadata } from '@nestjs/common';
import { IQuery } from '../interfaces/index.js';

export const QUERY_HANDLER_METADATA = 'QUERY_HANDLER_METADATA';

/**
 * Decorator to mark a class as a query handler
 * @param query - The query class that this handler handles
 * @returns Class decorator
 *
 * @example
 * ```typescript
 * @QueryHandler(GetCategoryQuery)
 * export class GetCategoryQueryHandler implements IQueryHandler<GetCategoryQuery, Category> {
 *   async execute(query: GetCategoryQuery): Promise<Category> {
 *     // Implementation
 *   }
 * }
 * ```
 */
export const QueryHandler = (query: new (...args: any[]) => IQuery): ClassDecorator => {
  return SetMetadata(QUERY_HANDLER_METADATA, query);
};
