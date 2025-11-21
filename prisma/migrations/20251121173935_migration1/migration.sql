-- AlterTable
ALTER TABLE "RecordingSession" RENAME CONSTRAINT "Session_pkey" TO "RecordingSession_pkey";

-- AlterTable
ALTER TABLE "Session" RENAME CONSTRAINT "AuthSession_pkey" TO "Session_pkey";

-- RenameIndex
ALTER INDEX "AuthSession_token_key" RENAME TO "Session_token_key";
