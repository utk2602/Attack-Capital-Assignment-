/*
  Warnings:

  - Renamed `Session` table to `RecordingSession`
  - Renamed `AuthSession` table to `Session`

*/
-- DropForeignKey
ALTER TABLE "AuthSession" DROP CONSTRAINT "AuthSession_userId_fkey";

-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT "Session_userId_fkey";

-- DropForeignKey
ALTER TABLE "TranscriptChunk" DROP CONSTRAINT "TranscriptChunk_sessionId_fkey";

-- Rename Session to RecordingSession
ALTER TABLE "Session" RENAME TO "RecordingSession";

-- Rename AuthSession to Session
ALTER TABLE "AuthSession" RENAME TO "Session";

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordingSession" ADD CONSTRAINT "RecordingSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranscriptChunk" ADD CONSTRAINT "TranscriptChunk_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "RecordingSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
