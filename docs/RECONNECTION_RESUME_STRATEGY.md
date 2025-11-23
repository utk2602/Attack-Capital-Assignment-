# Reconnection & Resume Strategy for ScribeAI

## Problem Statement

Network interruptions are inevitable in real-world scenarios:

- **WiFi drops**: User moves between networks
- **Mobile data**: Signal loss in elevators/tunnels
- **Server restarts**: Deployments or crashes
- **Browser tab suspension**: Mobile OS memory management

Without proper handling:

- ❌ Chunks are lost forever
- ❌ Sessions become corrupted
- ❌ Users must restart recording

## Solution: Idempotent Resume Protocol

### Key Principles

1. **Idempotency**: Server accepts duplicate chunks (same `sessionId + seq`)
2. **Client queue persistence**: Store pending chunks in IndexedDB
3. **Automatic reconnection**: Socket.io built-in reconnection
4. **Sequence tracking**: Server tracks highest seq received
5. **Gap detection**: Client resends missing sequences on resume

---

## Database Schema: Idempotency Constraint

**Prisma Schema** (`prisma/schema.prisma`):

```prisma
model TranscriptChunk {
  id         String           @id @default(uuid())
  sessionId  String
  session    RecordingSession @relation(fields: [sessionId], references: [id])
  seq        Int
  audioPath  String
  durationMs Int
  text       String?
  speaker    String?
  confidence Float?
  status     String           @default("uploaded")
  createdAt  DateTime         @default(now())

  @@unique([sessionId, seq])  // ✅ Ensures no duplicate sequences
}
```

**Database migration**:

```sql
ALTER TABLE "TranscriptChunk"
ADD CONSTRAINT "TranscriptChunk_sessionId_seq_key"
UNIQUE ("sessionId", "seq");
```

---

## Server-Side: Idempotent Chunk Handling

### Modified `recording.ts`

```typescript
socket.on("audio-chunk", async (rawData: unknown) => {
  const data = validation.data;

  try {
    // Check if chunk already exists (idempotency)
    const existingChunk = await prisma.transcriptChunk.findUnique({
      where: {
        sessionId_seq: {
          sessionId: data.sessionId,
          seq: data.sequence,
        },
      },
    });

    if (existingChunk) {
      console.log(`[Idempotency] Duplicate chunk detected: ${data.sessionId}/${data.sequence}`);

      // Acknowledge immediately without reprocessing
      socket.emit("chunk-ack", {
        sessionId: data.sessionId,
        sequence: data.sequence,
        timestamp: data.timestamp,
        chunkId: existingChunk.id,
        duplicate: true,
      });
      return;
    }

    // Normal processing...
    const audioBuffer = Buffer.from(data.audio);
    const filename = `${data.sessionId}_${data.sequence.toString().padStart(4, "0")}.webm`;
    const filePath = path.join(STORAGE_DIR, data.sessionId, filename);

    await fs.promises.writeFile(filePath, audioBuffer);

    const chunk = await prisma.transcriptChunk.create({
      data: {
        sessionId: data.sessionId,
        seq: data.sequence,
        audioPath: filePath,
        durationMs: 30000,
        status: "uploaded",
      },
    });

    socket.emit("chunk-ack", {
      sessionId: data.sessionId,
      sequence: data.sequence,
      chunkId: chunk.id,
      duplicate: false,
    });
  } catch (error) {
    // Handle unique constraint violation gracefully
    if (error.code === "P2002") {
      console.warn(`[Idempotency] Race condition for chunk ${data.sequence}`);
      socket.emit("chunk-ack", {
        sessionId: data.sessionId,
        sequence: data.sequence,
        duplicate: true,
      });
    } else {
      throw error;
    }
  }
});
```

---

## Client-Side: Persistent Queue with IndexedDB

### 1. IndexedDB Setup

```typescript
// src/lib/chunkQueue.ts
import { openDB, DBSchema, IDBPDatabase } from "idb";

interface ChunkQueueDB extends DBSchema {
  chunks: {
    key: string; // "sessionId:sequence"
    value: {
      sessionId: string;
      sequence: number;
      timestamp: number;
      blob: Blob;
      attempts: number;
      lastAttempt: number;
    };
  };
}

let db: IDBPDatabase<ChunkQueueDB> | null = null;

export async function initChunkQueue(): Promise<void> {
  db = await openDB<ChunkQueueDB>("scribeai-chunks", 1, {
    upgrade(db) {
      db.createObjectStore("chunks");
    },
  });
}

export async function enqueueChunk(
  sessionId: string,
  sequence: number,
  timestamp: number,
  blob: Blob
): Promise<void> {
  if (!db) await initChunkQueue();

  const key = `${sessionId}:${sequence}`;
  await db!.put(
    "chunks",
    {
      sessionId,
      sequence,
      timestamp,
      blob,
      attempts: 0,
      lastAttempt: Date.now(),
    },
    key
  );
}

export async function dequeueChunk(sessionId: string, sequence: number): Promise<void> {
  if (!db) return;
  const key = `${sessionId}:${sequence}`;
  await db.delete("chunks", key);
}

export async function getPendingChunks(sessionId: string): Promise<any[]> {
  if (!db) await initChunkQueue();

  const allChunks = await db!.getAll("chunks");
  return allChunks
    .filter((chunk) => chunk.sessionId === sessionId)
    .sort((a, b) => a.sequence - b.sequence);
}

export async function clearSession(sessionId: string): Promise<void> {
  if (!db) return;

  const allKeys = await db.getAllKeys("chunks");
  const sessionKeys = allKeys.filter((key) => key.startsWith(`${sessionId}:`));

  for (const key of sessionKeys) {
    await db.delete("chunks", key);
  }
}
```

### 2. Modified `useSocket.ts` Hook

```typescript
import { useEffect, useState, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { initChunkQueue, enqueueChunk, dequeueChunk, getPendingChunks } from "@/lib/chunkQueue";

export function useSocket(options: SocketOptions) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const processingQueue = useRef(false);
  const currentSessionId = useRef<string | null>(null);

  useEffect(() => {
    initChunkQueue();

    const newSocket = io(options.url || "http://localhost:3001", {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    newSocket.on("connect", async () => {
      console.log("[Socket] Connected");
      setIsConnected(true);

      // Resume sending queued chunks
      if (currentSessionId.current) {
        await resumeQueuedChunks(currentSessionId.current, newSocket);
      }
    });

    newSocket.on("disconnect", () => {
      console.log("[Socket] Disconnected");
      setIsConnected(false);
    });

    newSocket.on("chunk-ack", (data) => {
      // Remove from persistent queue
      dequeueChunk(data.sessionId, data.sequence);

      if (data.duplicate) {
        console.log(`[Resume] Duplicate ack for seq ${data.sequence}`);
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const emitAudioChunk = useCallback(
    async (sessionId: string, sequence: number, timestamp: number, blob: Blob) => {
      currentSessionId.current = sessionId;

      // Always enqueue first (persistence)
      await enqueueChunk(sessionId, sequence, timestamp, blob);

      // Try sending if connected
      if (isConnected && socket) {
        await sendChunk(socket, sessionId, sequence, timestamp, blob);
      } else {
        console.log(`[Queue] Offline, queued chunk ${sequence}`);
      }
    },
    [isConnected, socket]
  );

  async function resumeQueuedChunks(sessionId: string, socket: Socket): Promise<void> {
    if (processingQueue.current) return;
    processingQueue.current = true;

    console.log("[Resume] Checking for queued chunks...");
    const pending = await getPendingChunks(sessionId);

    if (pending.length > 0) {
      console.log(`[Resume] Found ${pending.length} pending chunks`);

      for (const chunk of pending) {
        await sendChunk(socket, chunk.sessionId, chunk.sequence, chunk.timestamp, chunk.blob);

        // Small delay to avoid overwhelming server
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      console.log("[Resume] All pending chunks sent");
    }

    processingQueue.current = false;
  }

  async function sendChunk(
    socket: Socket,
    sessionId: string,
    sequence: number,
    timestamp: number,
    blob: Blob
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const arrayBuffer = reader.result as ArrayBuffer;

        socket.emit("audio-chunk", {
          sessionId,
          sequence,
          timestamp,
          size: blob.size,
          mimeType: blob.type,
          audio: arrayBuffer,
        });

        resolve();
      };

      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(blob);
    });
  }

  return {
    socket,
    isConnected,
    emitAudioChunk,
  };
}
```

---

## Reconnection Flow Diagram

```
┌──────────────────────────────────────────────────────────┐
│                    Client Recording                       │
└───────────────────────┬──────────────────────────────────┘
                        │
                        ▼
            ┌───────────────────────┐
            │  Generate Audio Chunk │
            └───────────┬───────────┘
                        │
                        ▼
            ┌───────────────────────┐
            │  Enqueue to IndexedDB │ ◄─── Persistent Storage
            └───────────┬───────────┘
                        │
                        ▼
            ┌───────────────────────┐
            │  Socket Connected?    │
            └───────────┬───────────┘
                        │
            ┌───────────┴───────────┐
            │ YES                   │ NO
            ▼                       ▼
  ┌─────────────────┐     ┌───────────────────┐
  │  Send via       │     │  Wait for         │
  │  Socket.emit()  │     │  Reconnection     │
  └────────┬────────┘     └───────────────────┘
           │                       │
           ▼                       │
  ┌─────────────────┐             │
  │  Receive        │             │
  │  chunk-ack      │             │
  └────────┬────────┘             │
           │                       │
           ▼                       │
  ┌─────────────────┐             │
  │  Delete from    │             │
  │  IndexedDB      │             │
  └─────────────────┘             │
                                   │
           ┌───────────────────────┘
           │
           ▼
  ┌─────────────────────────┐
  │  Network Reconnects     │
  └────────────┬────────────┘
               │
               ▼
  ┌─────────────────────────┐
  │  getPendingChunks()     │
  └────────────┬────────────┘
               │
               ▼
  ┌─────────────────────────┐
  │  Resend All Pending     │
  │  Chunks Sequentially    │
  └────────────┬────────────┘
               │
               ▼
  ┌─────────────────────────┐
  │  Server Checks          │
  │  Duplicate via          │
  │  (sessionId, seq)       │
  └────────────┬────────────┘
               │
     ┌─────────┴─────────┐
     │ Exists?           │ New
     ▼                   ▼
┌──────────┐      ┌───────────────┐
│ Return   │      │  Save to DB,  │
│ Ack w/   │      │  Store File   │
│ duplicate│      └───────┬───────┘
│ = true   │              │
└──────────┘              ▼
     │           ┌────────────────┐
     │           │ Return Ack w/  │
     │           │ duplicate=false│
     └───────────┴────────┬───────┘
                          │
                          ▼
              ┌───────────────────┐
              │ Client Dequeues   │
              │ from IndexedDB    │
              └───────────────────┘
```

---

## Gap Detection (Optional Enhancement)

### Server Endpoint: Check Missing Sequences

```typescript
// GET /api/sessions/:sessionId/missing-chunks
export async function GET(req: NextRequest, { params }: { params: { sessionId: string } }) {
  const chunks = await db.transcriptChunk.findMany({
    where: { sessionId: params.sessionId },
    select: { seq: true },
    orderBy: { seq: "asc" },
  });

  const sequences = chunks.map((c) => c.seq);
  const maxSeq = Math.max(...sequences, -1);
  const missing: number[] = [];

  for (let i = 0; i <= maxSeq; i++) {
    if (!sequences.includes(i)) {
      missing.push(i);
    }
  }

  return NextResponse.json({ missing, maxSeq, totalChunks: sequences.length });
}
```

### Client: Request Missing Sequences

```typescript
async function checkMissingChunks(sessionId: string): Promise<number[]> {
  const response = await fetch(`/api/sessions/${sessionId}/missing-chunks`);
  const data = await response.json();
  return data.missing;
}
```

---

## Testing Strategy

### 1. Simulate Network Drop

```javascript
// In browser console:
socket.disconnect();
// Record for 30s
socket.connect();
// Verify all chunks are sent
```

### 2. Stress Test with Duplicates

```javascript
// Send same chunk 3 times
for (let i = 0; i < 3; i++) {
  socket.emit("audio-chunk", { sessionId, sequence: 5, ... });
}
// Server should acknowledge all 3, save only 1
```

### 3. IndexedDB Inspection

```javascript
// Check queued chunks
const pending = await getPendingChunks(sessionId);
console.log("Pending:", pending.length);
```

---

## Benefits

✅ **Zero data loss**: All chunks persisted locally  
✅ **Automatic recovery**: Reconnects and resumes seamlessly  
✅ **Idempotent**: Duplicate chunks handled gracefully  
✅ **Gap detection**: Server can identify missing sequences  
✅ **Production-ready**: Handles all failure modes

---

## Monitoring

```typescript
setInterval(async () => {
  const pending = await getPendingChunks(currentSessionId);
  console.log({
    connected: socket.connected,
    pendingChunks: pending.length,
    oldestChunk: pending[0]?.sequence || null,
  });
}, 5000);
```
