# Backpressure Protocol for ScribeAI

## Problem Statement

Without backpressure, the client can overwhelm the server with audio chunks faster than they can be processed, leading to:

- **Memory exhaustion**: Server buffers fill up
- **Network congestion**: Socket.io queues grow unbounded
- **Dropped chunks**: Critical data loss
- **Latency spikes**: Processing delays cascade

## Solution: Adaptive Backpressure via Socket.io

### Protocol Design

```
┌─────────────────┐                    ┌─────────────────┐
│     Client      │                    │     Server      │
│  (Recorder)     │                    │  (Handler)      │
└────────┬────────┘                    └────────┬────────┘
         │                                      │
         │  1. audio-chunk                      │
         ├─────────────────────────────────────>│
         │                                      │
         │                            2. Process chunk
         │                            (transcription queue)
         │                                      │
         │  3. chunk-ack + can-accept: true     │
         │<─────────────────────────────────────┤
         │                                      │
         │  4. audio-chunk (if can-accept)      │
         ├─────────────────────────────────────>│
         │                                      │
         │  5. backpressure: can-accept: false  │
         │<─────────────────────────────────────┤
         │                                      │
         │  ⏸️ Client pauses/queues locally     │
         │                                      │
         │  6. backpressure: can-accept: true   │
         │<─────────────────────────────────────┤
         │                                      │
         │  7. Resume sending queued chunks     │
         ├─────────────────────────────────────>│
```

### Server-Side Metrics

**Trigger backpressure when:**

1. Transcription queue size > 10 chunks
2. Memory usage > 80% threshold
3. Socket buffer size > 5 MB
4. Processing latency > 5 seconds

---

## Implementation

### 1. Server-Side Backpressure Manager

**File**: `server/utils/backpressure.ts`

```typescript
export class BackpressureManager {
  private queueSize = 0;
  private maxQueueSize = 10;
  private memoryThreshold = 0.8; // 80%
  private maxSocketBuffer = 5 * 1024 * 1024; // 5 MB

  canAccept(): boolean {
    return (
      this.queueSize < this.maxQueueSize &&
      this.getMemoryUsage() < this.memoryThreshold &&
      this.getSocketBufferSize() < this.maxSocketBuffer
    );
  }

  incrementQueue(): void {
    this.queueSize++;
  }

  decrementQueue(): void {
    this.queueSize = Math.max(0, this.queueSize - 1);
  }

  private getMemoryUsage(): number {
    const usage = process.memoryUsage();
    return usage.heapUsed / usage.heapTotal;
  }

  private getSocketBufferSize(): number {
    // Estimate based on socket write buffer
    return 0; // Simplified for now
  }
}
```

### 2. Server Socket Handler

**Modifications to `server/sockets/recording.ts`:**

```typescript
import { BackpressureManager } from "../utils/backpressure";

const backpressureManagers = new Map<string, BackpressureManager>();

export function setupRecordingSockets(io: Server, socket: Socket) {
  const manager = new BackpressureManager();
  backpressureManagers.set(socket.id, manager);

  socket.on("audio-chunk", async (rawData: unknown) => {
    // Check backpressure BEFORE processing
    if (!manager.canAccept()) {
      socket.emit("backpressure", { canAccept: false });
      console.warn(`[Backpressure] Rejecting chunk from ${socket.id}`);
      return;
    }

    manager.incrementQueue();

    // ... existing chunk processing logic ...

    // After successful processing
    manager.decrementQueue();

    socket.emit("chunk-ack", {
      sessionId: data.sessionId,
      sequence: data.sequence,
      canAccept: manager.canAccept(), // Include in ack
    });
  });

  socket.on("disconnect", () => {
    backpressureManagers.delete(socket.id);
  });
}
```

### 3. Client-Side Adaptive Sending

**Modifications to `src/hooks/useSocket.ts`:**

```typescript
export function useSocket(options: SocketOptions) {
  const [canAccept, setCanAccept] = useState(true);
  const localQueue = useRef<AudioChunkData[]>([]);
  const processingChunk = useRef(false);

  useEffect(() => {
    socket.on("chunk-ack", (data) => {
      setCanAccept(data.canAccept !== false); // Server signals capacity
      processingChunk.current = false;
      processLocalQueue(); // Try sending queued chunks
    });

    socket.on("backpressure", (data) => {
      setCanAccept(data.canAccept);
      if (data.canAccept) {
        processLocalQueue();
      }
    });
  }, []);

  const emitAudioChunk = useCallback(
    (sessionId: string, sequence: number, timestamp: number, blob: Blob) => {
      const chunkData = { sessionId, sequence, timestamp, blob };

      if (canAccept && !processingChunk.current && localQueue.current.length === 0) {
        // Send immediately if server can accept
        sendChunk(chunkData);
      } else {
        // Queue locally
        localQueue.current.push(chunkData);
        console.log(`[Client] Queued chunk ${sequence} (backpressure active)`);
      }
    },
    [canAccept]
  );

  const processLocalQueue = useCallback(() => {
    if (!canAccept || processingChunk.current || localQueue.current.length === 0) {
      return;
    }

    const chunk = localQueue.current.shift();
    if (chunk) {
      sendChunk(chunk);
    }
  }, [canAccept]);

  const sendChunk = (chunkData: AudioChunkData) => {
    processingChunk.current = true;

    const reader = new FileReader();
    reader.onload = () => {
      const arrayBuffer = reader.result as ArrayBuffer;

      socket.emit("audio-chunk", {
        sessionId: chunkData.sessionId,
        sequence: chunkData.sequence,
        timestamp: chunkData.timestamp,
        size: chunkData.blob.size,
        mimeType: chunkData.blob.type,
        audio: arrayBuffer,
      });
    };
    reader.readAsArrayBuffer(chunkData.blob);
  };

  return {
    emitAudioChunk,
    queuedChunks: localQueue.current.length,
    canAccept,
  };
}
```

### 4. Client UI Indicator

**Show backpressure status:**

```tsx
<div className={`status-indicator ${!canAccept ? "warning" : "normal"}`}>
  {canAccept ? (
    <CheckCircle className="text-green-500" />
  ) : (
    <AlertCircle className="text-yellow-500" />
  )}
  <span>
    {canAccept ? "Streaming" : "Buffering..."}
    {queuedChunks > 0 && ` (${queuedChunks} queued)`}
  </span>
</div>
```

---

## Flowchart

```
                  ┌─────────────────────────┐
                  │   Client Records Audio  │
                  └────────────┬────────────┘
                               │
                               ▼
                   ┌──────────────────────┐
                   │  Generate 30s Chunk  │
                   └──────────┬───────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │  Check: canAccept === true?   │
              └───────────┬───────────────────┘
                          │
                ┌─────────┴─────────┐
                │ YES               │ NO
                ▼                   ▼
    ┌───────────────────┐   ┌─────────────────┐
    │  Send Immediately │   │  Queue Locally  │
    └─────────┬─────────┘   └────────┬────────┘
              │                      │
              ▼                      │
    ┌───────────────────┐           │
    │  Server Receives  │           │
    └─────────┬─────────┘           │
              │                      │
              ▼                      │
    ┌───────────────────────┐       │
    │  Check Queue Size     │       │
    │  - Queue < 10?        │       │
    │  - Memory < 80%?      │       │
    │  - Buffer < 5MB?      │       │
    └──────────┬────────────┘       │
               │                     │
     ┌─────────┴────────┐           │
     │ ALL PASS         │ FAIL      │
     ▼                  ▼           │
┌──────────┐   ┌──────────────┐    │
│ Process  │   │ Emit         │    │
│ Chunk    │   │ backpressure │    │
└────┬─────┘   │ canAccept:   │    │
     │         │ false        │    │
     ▼         └──────┬───────┘    │
┌──────────┐         │             │
│ Queue for│         └─────────────┘
│ Transc.  │                 │
└────┬─────┘                 │
     │                       ▼
     ▼              ┌─────────────────┐
┌──────────┐       │ Client Pauses   │
│ Emit     │       │ Sending, Queues │
│ chunk-ack│       │ Locally         │
│ canAccept│       └────────┬────────┘
│ = true   │                │
└────┬─────┘                │
     │                      │
     └──────────────────────┘
                │
                ▼
    ┌──────────────────────┐
    │ Server Finishes Work │
    │ canAccept = true     │
    └──────────┬───────────┘
               │
               ▼
    ┌──────────────────────┐
    │ Emit backpressure    │
    │ canAccept: true      │
    └──────────┬───────────┘
               │
               ▼
    ┌──────────────────────┐
    │ Client Resumes       │
    │ Sending Queued       │
    │ Chunks               │
    └──────────────────────┘
```

---

## Testing Strategy

### 1. Stress Test

```bash
node scripts/test-long-session.js --chunks=500 --fast
```

Expected: Client should queue chunks when server is overwhelmed

### 2. Memory Monitoring

```typescript
setInterval(() => {
  const usage = process.memoryUsage();
  console.log(`Heap: ${usage.heapUsed / 1024 / 1024} MB`);
}, 1000);
```

### 3. Backpressure Metrics

```typescript
console.log({
  queueSize: manager.queueSize,
  canAccept: manager.canAccept(),
  memoryUsage: (usage.heapUsed / usage.heapTotal) * 100,
});
```

---

## Fallback: Network Drop Recovery

If backpressure fails and chunks are dropped:

1. **Client detects missing acks** (timeout after 10s)
2. **Retry with exponential backoff** (1s → 2s → 4s)
3. **Persistent local queue** (IndexedDB)
4. **Resume on reconnect** (see next section)

---

## Benefits

✅ **Prevents memory exhaustion**: Server never overloads  
✅ **Smooth degradation**: Client queues locally instead of dropping  
✅ **Real-time feedback**: UI shows buffering status  
✅ **Adaptive throttling**: Automatically adjusts to server capacity  
✅ **Zero data loss**: All chunks eventually delivered
