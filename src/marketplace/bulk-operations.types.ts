/** Kind of bulk operation performed on marketplace services. */
export type BulkOperationType = 'create' | 'update' | 'delete';

/** Outcome for a single item within a bulk operation. */
export type BulkItemStatus = 'succeeded' | 'failed';

/** Overall outcome of a bulk operation. */
export type BulkOperationStatus = 'completed' | 'partial' | 'failed';

/** Per-item result entry of a bulk operation. */
export interface BulkItemResult {
  /** Id of the affected service, when known. */
  id?: string;
  /** Position of the item in the original request payload. */
  index: number;
  status: BulkItemStatus;
  /** Failure reason for failed items. */
  error?: string;
}

/**
 * Summary of a bulk operation, returned by the endpoints and queryable
 * afterwards by `operationId` for status tracking.
 */
export interface BulkOperationSummary {
  operationId: string;
  type: BulkOperationType;
  status: BulkOperationStatus;
  total: number;
  succeeded: number;
  failed: number;
  startedAt: string;
  completedAt: string;
  results: BulkItemResult[];
}
