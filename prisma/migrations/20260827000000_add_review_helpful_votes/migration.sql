-- Add denormalised helpful-vote count to reviews
ALTER TABLE "Review" ADD COLUMN "helpfulCount" INTEGER NOT NULL DEFAULT 0;

-- Track individual helpful votes (one per user per review)
CREATE TABLE "ReviewHelpfulVote" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewHelpfulVote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReviewHelpfulVote_reviewId_userId_key" ON "ReviewHelpfulVote"("reviewId", "userId");

ALTER TABLE "ReviewHelpfulVote" ADD CONSTRAINT "ReviewHelpfulVote_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;
