-- Payment transaction verification columns used by PaymentVerificationService.
-- The schema defines these but the original migration never created them.
ALTER TABLE "Payment"
    ADD COLUMN IF NOT EXISTS "lastCheckedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "retryCount" INTEGER NOT NULL DEFAULT 0;
