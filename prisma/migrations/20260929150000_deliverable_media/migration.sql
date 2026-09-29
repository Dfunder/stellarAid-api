-- CreateTable
CREATE TABLE "DeliverableMedia" (
    "deliverableId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DeliverableMedia_pkey" PRIMARY KEY ("deliverableId","mediaId")
);

-- CreateIndex
CREATE INDEX "DeliverableMedia_mediaId_idx" ON "DeliverableMedia"("mediaId");

-- AddForeignKey
ALTER TABLE "DeliverableMedia" ADD CONSTRAINT "DeliverableMedia_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES "Deliverable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliverableMedia" ADD CONSTRAINT "DeliverableMedia_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;
