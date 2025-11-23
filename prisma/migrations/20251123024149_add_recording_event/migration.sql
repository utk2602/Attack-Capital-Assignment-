-- CreateTable
CREATE TABLE "RecordingEvent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecordingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecordingEvent_sessionId_createdAt_idx" ON "RecordingEvent"("sessionId", "createdAt");

-- AddForeignKey
ALTER TABLE "RecordingEvent" ADD CONSTRAINT "RecordingEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "RecordingSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
