export type RefundStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

const RETRYABLE: ReadonlySet<RefundStatus> = new Set(['PENDING', 'FAILED']);

/** A refund stranded in FAILED must be re-queueable, not terminal. */
export function canRetryRefund(status: RefundStatus): boolean {
  return RETRYABLE.has(status);
}

export function nextStatusOnRetry(status: RefundStatus): RefundStatus {
  if (!canRetryRefund(status)) {
    throw new Error(`Refund in status ${status} cannot be retried`);
  }
  return 'PENDING';
}
