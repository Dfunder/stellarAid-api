import { Injectable, Logger } from '@nestjs/common';

/**
 * Payment confirmation robustness utilities (#627).
 * - Double-payment prevention via idempotency key tracking
 * - Blockchain transaction verification helpers
 * - Failed payment recovery tracking
 */
@Injectable()
export class PaymentConfirmationService {
  private readonly logger = new Logger(PaymentConfirmationService.name);

  /** In-process idempotency set. Production should use Redis or a DB unique constraint. */
  private readonly processedTxHashes = new Set<string>();

  /**
   * Returns true if this txHash has already been successfully processed.
   * Call before confirming a payment to prevent double-processing (#627).
   */
  isAlreadyProcessed(txHash: string): boolean {
    return this.processedTxHashes.has(txHash);
  }

  /** Mark a txHash as processed so duplicate submissions are rejected. */
  markProcessed(txHash: string): void {
    this.processedTxHashes.add(txHash);
    this.logger.debug(`TxHash marked as processed: ${txHash}`);
  }

  /**
   * Verify a transaction exists on the Stellar network (#627).
   * Returns true if the transaction is confirmed on-chain.
   */
  async verifyOnChain(txHash: string, horizonUrl: string): Promise<boolean> {
    try {
      const url = `${horizonUrl}/transactions/${txHash}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) return false;
      const data = (await res.json()) as { successful?: boolean };
      return data.successful === true;
    } catch (err) {
      this.logger.warn(`On-chain verification failed for ${txHash}: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }
}
