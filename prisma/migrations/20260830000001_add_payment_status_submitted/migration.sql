-- The schema's PaymentStatus enum includes SUBMITTED (used when a signed
-- transaction is confirmed), but it was never added to the original migration.
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'SUBMITTED';
