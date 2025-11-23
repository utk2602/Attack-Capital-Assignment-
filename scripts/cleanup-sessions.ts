
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function cleanupOldSessions() {
  try {
    console.log("Starting session cleanup...\n");

    const totalSessions = await prisma.recordingSession.count();
    console.log(`📊 Total sessions in database: ${totalSessions}`);

    // Get sessions older than 1 hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const oldSessions = await prisma.recordingSession.findMany({
      where: {
        startedAt: {
          lt: oneHourAgo,
        },
      },
      select: {
        id: true,
        title: true,
        status: true,
        startedAt: true,
      },
    });

    console.log(`\n🗑️  Found ${oldSessions.length} sessions older than 1 hour:`);
    oldSessions.forEach((session) => {
      console.log(
        `   - ${session.id} | ${session.title} | ${session.status} | ${session.startedAt}`
      );
    });

    if (oldSessions.length === 0) {
      console.log("\n✅ No old sessions to clean up!");
      return;
    }

    // Prompt for confirmation (or auto-confirm in script)
    console.log("\n⚠️  This will delete these sessions and all related data.");
    console.log("   Continuing in 3 seconds... (Ctrl+C to cancel)\n");

    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Delete transcript chunks first (foreign key constraint)
    const deletedChunks = await prisma.transcriptChunk.deleteMany({
      where: {
        sessionId: {
          in: oldSessions.map((s) => s.id),
        },
      },
    });

    console.log(`🗑️  Deleted ${deletedChunks.count} transcript chunks`);

    // Delete recording events
    const deletedEvents = await prisma.recordingEvent.deleteMany({
      where: {
        sessionId: {
          in: oldSessions.map((s) => s.id),
        },
      },
    });

    console.log(`🗑️  Deleted ${deletedEvents.count} recording events`);

    // Delete sessions
    const deletedSessions = await prisma.recordingSession.deleteMany({
      where: {
        id: {
          in: oldSessions.map((s) => s.id),
        },
      },
    });

    console.log(`🗑️  Deleted ${deletedSessions.count} sessions`);

    console.log("\n✅ Cleanup completed successfully!");

    // Show remaining sessions
    const remainingSessions = await prisma.recordingSession.count();
    console.log(`📊 Remaining sessions: ${remainingSessions}`);
  } catch (error) {
    console.error("❌ Error during cleanup:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Alternative: Clean up ALL sessions (use with caution!)
async function cleanupAllSessions() {
  try {
    console.log("🧹 Cleaning up ALL sessions...\n");

    const deletedChunks = await prisma.transcriptChunk.deleteMany({});
    console.log(`🗑️  Deleted ${deletedChunks.count} transcript chunks`);

    const deletedEvents = await prisma.recordingEvent.deleteMany({});
    console.log(`🗑️  Deleted ${deletedEvents.count} recording events`);

    const deletedSessions = await prisma.recordingSession.deleteMany({});
    console.log(`🗑️  Deleted ${deletedSessions.count} sessions`);

    console.log("\n✅ All sessions cleaned up!");
  } catch (error) {
    console.error("❌ Error during cleanup:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Clean up sessions for a specific user
async function cleanupUserSessions(userId: string) {
  try {
    console.log(`🧹 Cleaning up sessions for user: ${userId}\n`);

    const userSessions = await prisma.recordingSession.findMany({
      where: { userId },
      select: { id: true, title: true, startedAt: true },
    });

    console.log(`Found ${userSessions.length} sessions for this user`);

    const deletedChunks = await prisma.transcriptChunk.deleteMany({
      where: {
        sessionId: {
          in: userSessions.map((s) => s.id),
        },
      },
    });

    const deletedEvents = await prisma.recordingEvent.deleteMany({
      where: {
        sessionId: {
          in: userSessions.map((s) => s.id),
        },
      },
    });

    const deletedSessions = await prisma.recordingSession.deleteMany({
      where: { userId },
    });

    console.log(`\n✅ Cleaned up ${deletedSessions.count} sessions`);
  } catch (error) {
    console.error("❌ Error during cleanup:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Main execution
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case "all":
    cleanupAllSessions();
    break;
  case "user":
    const userId = args[1];
    if (!userId) {
      console.error("❌ Please provide a user ID: npm run cleanup user <userId>");
      process.exit(1);
    }
    cleanupUserSessions(userId);
    break;
  case "old":
  default:
    cleanupOldSessions();
    break;
}
