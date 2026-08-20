/**
 * Schema manager interface for database schema operations.
 *
 * The canonical definition now lives alongside the dialects, since a schema manager
 * is a per-engine concern. Re-exported here so the public type path is unchanged.
 */
export type { DbPool, ISchemaManager } from '../dialects/dialect.interface.js';
