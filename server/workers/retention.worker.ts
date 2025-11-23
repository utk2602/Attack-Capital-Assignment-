import * as fs from "fs/promises";
import * as path from "path";
import { prisma as db } from "@/lib/db";
import archiver from "archiver";
import { createWriteStream } from "fs";

const RETENTION_DAYS = 7;
const STORAGE_DIR = path.join(process.cwd(), "storage", "audio-chunks");
const ARCHIVE_DIR = path.join(process.cwd(), "storage", "archives");
export async function runRetentionCleanup(): Promise<void> {
  console.log("[Retention] Starting cleanup job...");

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

  const expiredSessions = await db.recordingSession.findMany({
    where: {
      status: "completed",
      endedAt: {
        lt: cutoffDate,
      },
    },
    include: {
      chunks: {
        select: { id: true, seq: true, audioPath: true },
        orderBy: { seq: "asc" },
      },
    },
  });

  console.log(`[Retention] Found ${expiredSessions.length} expired sessions`);

  for (const session of expiredSessions) {
    try {
      await archiveAndCleanupSession(session);
    } catch (error) {
      console.error(`[Retention] Failed to cleanup session ${session.id}:`, error);
    }
  }

  console.log("[Retention] Cleanup job completed");
}

async function archiveAndCleanupSession(session: any): Promise<void> {
  console.log(`[Retention] Processing session: ${session.id}`);

  const sessionDir = path.join(STORAGE_DIR, session.id);
  const archivePath = path.join(ARCHIVE_DIR, `${session.id}.zip`);

  await fs.mkdir(ARCHIVE_DIR, { recursive: true });

  await createArchive(session, sessionDir, archivePath);

  const archiveExists = await fs
    .access(archivePath)
    .then(() => true)
    .catch(() => false);

  if (!archiveExists) {
    throw new Error("Archive creation failed");
  }

  await deleteSessionDirectory(sessionDir);

  await db.transcriptChunk.updateMany({
    where: { sessionId: session.id },
    data: { status: "archived" },
  });

  console.log(`[Retention] ✅ Archived and cleaned up session: ${session.id}`);
}

function createArchive(session: any, sourceDir: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(destPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => {
      console.log(`[Retention] Archive created: ${archive.pointer()} bytes`);
      resolve();
    });

    archive.on("error", (err) => reject(err));

    archive.pipe(output);

    archive.append(
      JSON.stringify(
        {
          sessionId: session.id,
          userId: session.userId,
          title: session.title,
          startedAt: session.startedAt,
          endedAt: session.endedAt,
          chunkCount: session.chunks.length,
          transcript: session.transcript,
          summary: session.summaryJSON,
        },
        null,
        2
      ),
      { name: "metadata.json" }
    );

    if (session.transcript) {
      archive.append(session.transcript, { name: "transcript.txt" });
    }

    archive.directory(sourceDir, "chunks");

    archive.finalize();
  });
}

async function deleteSessionDirectory(dirPath: string): Promise<void> {
  try {
    const exists = await fs
      .access(dirPath)
      .then(() => true)
      .catch(() => false);

    if (!exists) return;

    await fs.rm(dirPath, { recursive: true, force: true });
    console.log(`[Retention] Deleted directory: ${dirPath}`);
  } catch (error) {
    console.error(`[Retention] Failed to delete directory:`, error);
    throw error;
  }
}


export async function getStorageMetrics(): Promise<{
  hotStorageMB: number;
  archiveStorageMB: number;
  sessionCount: number;
  oldestSession: Date | null;
}> {
  const hotSize = await getDirectorySize(STORAGE_DIR);
  const archiveSize = await getDirectorySize(ARCHIVE_DIR);

  const sessionCount = await db.recordingSession.count({
    where: { status: "completed" },
  });

  const oldestSession = await db.recordingSession.findFirst({
    where: { status: "completed" },
    orderBy: { endedAt: "asc" },
    select: { endedAt: true },
  });

  return {
    hotStorageMB: Math.round(hotSize / 1024 / 1024),
    archiveStorageMB: Math.round(archiveSize / 1024 / 1024),
    sessionCount,
    oldestSession: oldestSession?.endedAt || null,
  };
}

async function getDirectorySize(dirPath: string): Promise<number> {
  let totalSize = 0;

  try {
    const exists = await fs
      .access(dirPath)
      .then(() => true)
      .catch(() => false);

    if (!exists) return 0;

    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        totalSize += await getDirectorySize(fullPath);
      } else {
        const stats = await fs.stat(fullPath);
        totalSize += stats.size;
      }
    }
  } catch (error) {
    console.error(`[Retention] Error calculating directory size:`, error);
  }

  return totalSize;
}


export function initializeRetentionWorker(): void {
  const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; 

  console.log("[Retention] Worker initialized - runs daily at 2 AM");

  setInterval(
    async () => {
      const now = new Date();
      if (now.getHours() === 2) {
        await runRetentionCleanup();
      }
    },
    60 * 60 * 1000
  );

  if (process.env.NODE_ENV === "development") {
    runRetentionCleanup().catch(console.error);
  }
}
