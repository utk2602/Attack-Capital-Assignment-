import { promises as fs } from "fs";
import { join } from "path";

/**
 * Storage utility for saving audio chunks locally
 */

const STORAGE_DIR = process.env.AUDIO_STORAGE_PATH || "./storage/audio-chunks";

/**
 * Ensure storage directory exists
 */
export async function ensureStorageDir() {
  try {
    await fs.mkdir(STORAGE_DIR, { recursive: true });
  } catch (error) {
    console.error("Failed to create storage directory:", error);
    throw error;
  }
}

/**
 * Save audio chunk to local file system
 * @param sessionId - Session ID
 * @param seq - Chunk sequence number
 * @param buffer - Audio data buffer
 * @returns File path
 */
export async function saveAudioChunk(
  sessionId: string,
  seq: number,
  buffer: Buffer
): Promise<string> {
  await ensureStorageDir();

  const sessionDir = join(STORAGE_DIR, sessionId);
  await fs.mkdir(sessionDir, { recursive: true });

  const filename = `${seq}-${Date.now()}.webm`;
  const filepath = join(sessionDir, filename);

  await fs.writeFile(filepath, buffer);

  return filepath;
}

/**
 * Read audio chunk from local file system
 * @param filepath - File path
 * @returns Audio data buffer
 */
export async function readAudioChunk(filepath: string): Promise<Buffer> {
  return await fs.readFile(filepath);
}

/**
 * Delete session audio chunks
 * @param sessionId - Session ID
 */
export async function deleteSessionChunks(sessionId: string): Promise<void> {
  const sessionDir = join(STORAGE_DIR, sessionId);
  try {
    await fs.rm(sessionDir, { recursive: true, force: true });
  } catch (error) {
    console.error("Failed to delete session chunks:", error);
  }
}
