# Transcription Worker Implementation Examples

## Example 1: Basic Worker Setup

### Initialize Worker in Server

```typescript
// server/server.ts
import { initializeTranscriptionWorker } from "./workers/transcription.worker";

// Start worker on server initialization
initializeTranscriptionWorker();
```

### Queue Transcription from Socket Handler

```typescript
// server/sockets/recording.ts
import { queueTranscription } from "../workers/transcription.worker";

socket.on("audio-chunk", async (data) => {
  // ... save chunk to disk and database ...

  // Queue for transcription
  await queueTranscription(chunk.id, data.sessionId, data.sequence);
});
```

## Example 2: Worker with Exponential Backoff

### Queue Configuration

```typescript
const transcriptionQueue = new SimpleQueue({
  concurrency: 3, // Process 3 chunks simultaneously
  maxAttempts: 3, // Retry up to 3 times
  backoffMs: 1000, // Start with 1 second delay
  exponentialBackoff: true, // 1s, 2s, 4s delays
});
```

### Retry Behavior

```
Attempt 1: Immediate
Attempt 2: After 1000ms delay
Attempt 3: After 2000ms delay
Attempt 4: After 4000ms delay
Failed: After 3 attempts
```

## Example 3: Monitoring Queue Status

### Get Queue Statistics

```typescript
import { getQueueStats } from "./workers/transcription.worker";

const stats = getQueueStats();
console.log(stats);
// {
//   queued: 5,
//   processing: 3,
//   completed: 42,
//   failed: 1,
//   concurrency: 3
// }
```

### API Endpoint for Queue Status

```typescript
// src/app/api/queue/status/route.ts
import { getQueueStats } from "@/server/workers/transcription.worker";

export async function GET() {
  const stats = getQueueStats();
  return Response.json(stats);
}
```

## Example 4: Optimized Prompts in Action

### Single-Chunk Transcription

```typescript
const result = await gemini.transcribeChunk("session_abc123", 5, "./chunk_5.wav", {
  previousContext: "The speaker was discussing quarterly results.",
  enableDiarization: false, // Uses optimized single-chunk prompt
  languageHint: "en-US",
  temperature: 0.1,
});

console.log(result.text);
// "The revenue increased by 25% compared to last quarter..."
```

### Diarization with Structured Output

```typescript
const result = await gemini.transcribeChunk("session_abc123", 10, "./chunk_10.wav", {
  previousContext: "SPEAKER_1 was asking about the budget.",
  enableDiarization: true, // Uses JSON-structured prompt
  languageHint: "en-US",
  temperature: 0.1,
});

console.log(result.text);
// [
//   {"speaker":"SPEAKER_1","text":"What is the budget for Q3?","start":0.0,"end":3.5},
//   {"speaker":"SPEAKER_2","text":"We allocated $500,000","start":3.6,"end":7.2}
// ]
```

## Example 5: Server-Side Aggregation

### Merge Chunks into Full Transcript

```typescript
import { mergeChunkTranscripts } from "./utils/transcriptAggregation";

const aggregated = await mergeChunkTranscripts("session_abc123");

console.log({
  fullText: aggregated.fullText.substring(0, 100) + "...",
  wordCount: aggregated.wordCount,
  speakers: aggregated.speakers,
  duration: aggregated.totalDuration / 1000 + "s",
  chunks: aggregated.chunkCount,
});

// {
//   fullText: "Hello everyone, welcome to today's meeting. We'll be discussing...",
//   wordCount: 1234,
//   speakers: ['SPEAKER_1', 'SPEAKER_2'],
//   duration: '325s',
//   chunks: 65
// }
```

### Update Session with Full Transcript

```typescript
import { updateSessionTranscript } from "./utils/transcriptAggregation";

// Called automatically when all chunks are transcribed
await updateSessionTranscript("session_abc123");

// Session record now has:
// - transcript: "full merged transcript..."
// - status: "completed"
// - summaryJSON: { wordCount, speakers, totalDuration, chunkCount }
```

## Example 6: Export Transcript Formats

### Export as Plain Text

```typescript
import { exportTranscript } from "./utils/transcriptAggregation";

const txtContent = await exportTranscript("session_abc123", "txt");

console.log(txtContent);
// [SPEAKER_1] Hello everyone, welcome to today's meeting.
//
// [SPEAKER_2] Thank you for having us. Let's begin with...
```

### Export as SRT Subtitles

```typescript
const srtContent = await exportTranscript("session_abc123", "srt");

console.log(srtContent);
// 1
// 00:00:00,000 --> 00:00:05,200
// Hello everyone, welcome to today's meeting.
//
// 2
// 00:00:05,300 --> 00:00:10,000
// Thank you for having us. Let's begin with...
```

### Export as WebVTT

```typescript
const vttContent = await exportTranscript("session_abc123", "vtt");

console.log(vttContent);
// WEBVTT
//
// 1
// 00:00:00.000 --> 00:00:05.200
// <v SPEAKER_1>Hello everyone, welcome to today's meeting.
//
// 2
// 00:00:05.300 --> 00:00:10.000
// <v SPEAKER_2>Thank you for having us. Let's begin with...
```

## Example 7: Real-time Progress Tracking

### Get Transcription Progress

```typescript
import { getTranscriptionProgress } from "./utils/transcriptAggregation";

const progress = await getTranscriptionProgress("session_abc123");

console.log(progress);
// {
//   total: 65,
//   transcribed: 42,
//   processing: 3,
//   failed: 1,
//   uploaded: 19,
//   progress: 64.62
// }
```

### API Endpoint for Progress

```typescript
// src/app/api/sessions/[sessionId]/transcription-status/route.ts
import { getTranscriptionProgress } from "@/server/utils/transcriptAggregation";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const progress = await getTranscriptionProgress(sessionId);
  return Response.json(progress);
}
```

### Client Polling for Progress

```typescript
// Client-side hook
useEffect(() => {
  const interval = setInterval(async () => {
    const response = await fetch(`/api/sessions/${sessionId}/transcription-status`);
    const progress = await response.json();

    setTranscriptionProgress(progress.progress);

    if (progress.progress === 100) {
      clearInterval(interval);
    }
  }, 2000); // Poll every 2 seconds

  return () => clearInterval(interval);
}, [sessionId]);
```

## Example 8: Error Handling & Retry

### Automatic Retry on Failure

```typescript
// Worker automatically retries with exponential backoff
try {
  await processTranscription(chunkId, sessionId, sequence);
} catch (error) {
  // On failure, job is re-queued automatically
  // Backoff delays: 1s, 2s, 4s
  // After 3 failures, marked as permanently failed
}
```

### Manual Retry of Failed Jobs

```typescript
import { retryFailedJobs } from "./workers/transcription.worker";

// Retry all permanently failed jobs
retryFailedJobs();
console.log("Retrying all failed transcription jobs");
```

### Custom Error Recovery

```typescript
// server/workers/transcription.worker.ts
async function processTranscription(chunkId: string) {
  try {
    // ... conversion and transcription ...
  } catch (error) {
    // Update chunk status to failed
    await db.transcriptChunk.update({
      where: { id: chunkId },
      data: { status: "failed" },
    });

    // Emit error event to client
    io.to(`session:${sessionId}`).emit("transcription-error", {
      chunkId,
      sequence,
      error: error.message,
    });

    throw error; // Re-throw for queue retry logic
  }
}
```

## Example 9: Performance Monitoring

### Track Processing Times

```typescript
// In worker
const startTime = Date.now();

const conversionTime = Date.now() - conversionStart;
const transcriptionTime = Date.now() - transcriptionStart;
const totalTime = Date.now() - startTime;

console.log({
  chunk: chunkId,
  conversion: conversionTime + "ms",
  transcription: transcriptionTime + "ms",
  total: totalTime + "ms",
});

// Example output:
// {
//   chunk: 'chunk_xyz',
//   conversion: '287ms',
//   transcription: '3142ms',
//   total: '3429ms'
// }
```

## Example 10: Complete Integration Flow

### End-to-End Example

```typescript
// 1. Client uploads chunk
socket.emit("audio-chunk", {
  sessionId: "session_abc",
  sequence: 5,
  audio: arrayBuffer,
});

// 2. Server saves and queues
const chunk = await db.transcriptChunk.create({
  data: { sessionId, seq: 5, audioPath, status: "uploaded" },
});
await queueTranscription(chunk.id, sessionId, 5);

// 3. Worker processes
// - Converts WebM → WAV (287ms)
// - Calls Gemini API with context (3142ms)
// - Updates database with transcript
// - Emits WebSocket event

// 4. Client receives update
socket.on("transcript-updated", (data) => {
  updateTranscriptUI(data.sequence, data.text);
});

// 5. When all chunks done, auto-aggregate
if (allChunksTranscribed) {
  await updateSessionTranscript(sessionId);
  // Session now has full transcript
}

// 6. Export options available
const srt = await exportTranscript(sessionId, "srt");
downloadFile(srt, "transcript.srt");
```

## Performance Benchmarks

### Typical Processing Times (30s audio chunk)

- **WebM → WAV conversion**: 200-500ms
- **Gemini API transcription**: 2-5s
- **Database update**: 10-50ms
- **Total per chunk**: 3-6s

### Throughput with Concurrency=3

- **Sequential**: 65 chunks × 4s = 260s (4.3 minutes)
- **Parallel (3x)**: 65 chunks ÷ 3 × 4s = 87s (1.5 minutes)
- **Speedup**: 3x faster

## Next Steps

1. **Add to server initialization**: Call `initializeTranscriptionWorker()` in `server/server.ts`
2. **Integrate with sockets**: Queue transcription on chunk upload
3. **Build UI components**: Show progress and display transcripts
4. **Test end-to-end**: Record → Upload → Transcribe → Display
5. **Monitor performance**: Track processing times and queue stats
6. **Add export features**: Download SRT/VTT for video subtitles
