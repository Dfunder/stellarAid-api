-- Extend notifications with channel, scheduling and dispatch tracking
ALTER TABLE "Notification" ADD COLUMN "channel" TEXT NOT NULL DEFAULT 'IN_APP';
ALTER TABLE "Notification" ADD COLUMN "scheduledFor" TIMESTAMP(3);
ALTER TABLE "Notification" ADD COLUMN "sentAt" TIMESTAMP(3);

CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");
CREATE INDEX "Notification_scheduledFor_sentAt_idx" ON "Notification"("scheduledFor", "sentAt");

-- Per-user delivery preferences
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
    "mutedTypes" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationPreference_userId_key" ON "NotificationPreference"("userId");

-- Reusable templates
CREATE TABLE "NotificationTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'IN_APP',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationTemplate_key_key" ON "NotificationTemplate"("key");
