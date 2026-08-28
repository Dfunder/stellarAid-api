/**
 * Soft-delete utilities (#654).
 * Models that support soft delete have a nullable `deletedAt` field.
 * Use `softDeleteFilter()` in Prisma `where` clauses to exclude soft-deleted rows.
 * Use `softDeleteData()` as the `data` payload for a soft delete update.
 * Use `restoreData()` as the `data` payload to restore a soft-deleted record.
 */

/** Standard Prisma `where` filter that excludes soft-deleted records. */
export const softDeleteFilter = () => ({ deletedAt: null });

/** Data payload to soft-delete a record. */
export const softDeleteData = () => ({ deletedAt: new Date() });

/** Data payload to restore a soft-deleted record. */
export const restoreData = () => ({ deletedAt: null });

/** True if a record with a `deletedAt` field has been soft-deleted. */
export function isSoftDeleted(record: { deletedAt: Date | null }): boolean {
  return record.deletedAt !== null;
}
