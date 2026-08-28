-- Database indexing strategy (#648)
CREATE INDEX IF NOT EXISTS "Payment_commissionId_idx" ON "Payment"("commissionId");
CREATE INDEX IF NOT EXISTS "Payment_status_idx" ON "Payment"("status");
CREATE INDEX IF NOT EXISTS "Payment_createdAt_idx" ON "Payment"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Commission_artistId_idx" ON "Commission"("artistId");
CREATE INDEX IF NOT EXISTS "Commission_clientId_idx" ON "Commission"("clientId");
CREATE INDEX IF NOT EXISTS "Commission_status_idx" ON "Commission"("status");
CREATE INDEX IF NOT EXISTS "Commission_createdAt_idx" ON "Commission"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");
