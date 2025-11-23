# Real-Time Transcript Flow - Complete Guide

## 🎯 Overview

This document explains **exactly how transcripts appear in real-time** when you record audio.

---

## 📊 The Complete Flow (Step-by-Step)

### **Phase 1: Recording Setup**

```
USER ACTION                    SYSTEM RESPONSE
─────────────────────────────────────────────────────
1. User clicks "Start"    →    Create session in DB
                               Generate UUID
                               Join socket room
                               Status: "recording"
```

### **Phase 2: Audio Capture (Every 30 seconds)**

```
BROWSER                        CLIENT CODE
─────────────────────────────────────────────────────
1. MediaRecorder captures  →   useAudioRecorder.ts
   30s audio blob

2. ondataavailable event   →   handleChunk()

3. Blob ready              →   emitAudioChunk()
                               Socket.io sends to server
```

### **Phase 3: Server Processing**

```
SERVER COMPONENT               ACTION
─────────────────────────────────────────────────────
1. recording.ts             →  Receives "audio-chunk" event
   socket.on("audio-chunk")

2. Validation               →  Check: auth, rate limits, ownership

3. ChunkManager             →  Save audio file to disk
   .processChunk()             Create DB record (TranscriptChunk)
                               audioPath: storage/session_id/chunk_0001.webm

4. Queue Transcription      →  Add job to transcription queue
   queueTranscription()        Job data: { chunkId, sessionId, sequence }

5. Emit ACK                 →  socket.emit("chunk-ack")
                               Client knows chunk was received
```

### **Phase 4: Transcription (Async Background)**

```
WORKER                         ACTION
─────────────────────────────────────────────────────
1. Worker picks up job      →  transcription.worker.ts
                               processTranscription()

2. Load audio file          →  Read from disk
                               storage/session_id/chunk_0001.webm

3. Convert format           →  FFmpeg: WebM → WAV
                               Gemini needs WAV format

4. Call Gemini API          →  gemini.transcribeAudio(wavPath)
                               POST to Google Generative AI
                               Send audio as base64

5. Receive transcript       →  text: "Hello, this is a test..."
                               confidence: 0.95
                               processingTime: 2340ms

6. Update database          →  UPDATE TranscriptChunk
                               SET text = "...", status = "completed"
```

### **Phase 5: Real-Time Broadcast**

```
SERVER                         CLIENT
─────────────────────────────────────────────────────
1. Worker completed         →  Emit to room
   io.to(`session:${id}`)
   .emit("transcript-updated")

2. Event payload            →  {
                                  sequence: 0,
                                  text: "Hello...",
                                  speaker: "Speaker 1",
                                  timestamp: 30000,
                                  chunkId: "abc_0000"
                                }

3. TranscriptView receives →  socket.on("transcript-updated")

4. Update state             →  setSegments([...prev, newSegment])

5. React re-renders         →  UI shows new text
```

---

## 🔧 **Critical Components**

### **1. Client: TranscriptView Component**

**Location:** `src/components/TranscriptView.tsx`

**Purpose:** Displays transcript in real-time

**Key Code:**

```tsx
useEffect(() => {
  if (!socket || !sessionId) return;

  // Join the session room ONCE
  socket.emit("join", `session:${sessionId}`);

  // Listen for transcript updates
  const handleTranscriptUpdate = (data) => {
    console.log("Received transcript:", data);
    setSegments((prev) => [...prev, data]);
  };

  socket.on("transcript-updated", handleTranscriptUpdate);

  return () => {
    socket.off("transcript-updated", handleTranscriptUpdate);
    socket.emit("leave", `session:${sessionId}`);
  };
}, [socket, sessionId]); // Only run when these change
```

**Common Issue:** If you don't include dependencies `[socket, sessionId]`, it creates an infinite loop of join/leave.

---

### **2. Server: Recording Socket Handler**

**Location:** `server/sockets/recording.ts`

**Purpose:** Handle audio chunks and trigger transcription

**Key Code:**

```typescript
socket.on("audio-chunk", async (rawData) => {
  // 1. Validate data
  const validation = safeValidateSocketPayload(AudioChunkSchema, rawData);

  // 2. Save chunk
  const metadata = await chunkManager.processChunk(
    {
      sessionId: data.sessionId,
      sequence: data.sequence,
      audioData: Buffer.from(data.audio),
      mimeType: data.mimeType,
    },
    socket
  );

  // 3. Queue transcription (THIS IS CRITICAL!)
  const { queueTranscription } = await import("../workers/transcription.worker");
  await queueTranscription(chunkId, data.sessionId, data.sequence);

  // 4. Acknowledge
  socket.emit("chunk-ack", { ...metadata });
});
```

**What Was Missing:** The `queueTranscription()` call. Without this, chunks are saved but never transcribed!

---

### **3. Worker: Transcription Processor**

**Location:** `server/workers/transcription.worker.ts`

**Purpose:** Convert audio and call Gemini API

**Key Code:**

```typescript
async function processTranscription(chunkId, sessionId, sequence) {
  // 1. Get chunk from DB
  const chunk = await db.transcriptChunk.findUnique({ where: { id: chunkId } });

  // 2. Convert WebM → WAV
  const wavPath = await convertToWav(chunk.audioPath);

  // 3. Call Gemini
  const result = await gemini.transcribeAudio(wavPath);

  // 4. Save transcript
  await db.transcriptChunk.update({
    where: { id: chunkId },
    data: {
      text: result.text,
      confidence: result.confidence,
      status: "completed",
    },
  });

  // 5. Broadcast to clients (THIS MAKES IT REAL-TIME!)
  const io = getIO();
  io.to(`session:${sessionId}`).emit("transcript-updated", {
    sequence,
    text: result.text,
    timestamp: chunk.timestamp,
    chunkId,
  });
}
```

---

### **4. Gemini Service**

**Location:** `src/lib/gemini.ts`

**Purpose:** Interact with Google Generative AI API

**Key Code:**

```typescript
async transcribeAudio(audioPath: string) {
  const audioBuffer = await fs.readFile(audioPath);
  const audioBase64 = audioBuffer.toString("base64");

  const model = this.genAI.getGenerativeModel({
    model: "gemini-1.5-flash-latest" // Correct model name!
  });

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: "audio/wav",
        data: audioBase64
      }
    },
    { text: "Transcribe this audio. Return only the spoken text." }
  ]);

  return {
    text: result.response.text(),
    confidence: 0.95,
    processingTimeMs: Date.now() - startTime
  };
}
```

**Common Issue:** Using wrong model name like `"gemini-1.5-pro"` or `"models/gemini-1.5-flash"`. The correct format is `"gemini-1.5-flash-latest"`.

---

## 🐛 **Why Transcript Wasn't Showing (Your Issue)**

### **Problem 1: Transcription Not Queued** ❌

**Issue:** Audio chunks were saved but never sent to the transcription worker.

**Fix:** Added `queueTranscription()` call in `recording.ts` after chunk is saved.

```typescript
// BEFORE (Missing)
await chunkManager.processChunk(...);
backpressureManager.decrementQueue();

// AFTER (Fixed)
await chunkManager.processChunk(...);
await queueTranscription(chunkId, sessionId, sequence); // ← Added this!
backpressureManager.decrementQueue();
```

---

### **Problem 2: TranscriptView Join/Leave Loop** ❌

**Issue:** Component was constantly joining and leaving the room, causing it to miss events.

**Server logs showed:**

```
[Socket] xyz joined room: session:abc
[Socket] xyz left room: session:abc
[Socket] xyz joined room: session:abc
[Socket] xyz left room: session:abc
... (repeating forever)
```

**Fix:** Added dependency array `[socket, sessionId]` to `useEffect` so it only runs when these actually change.

```typescript
// BEFORE
useEffect(() => {
  socket.emit("join", `session:${sessionId}`);
  // ...
}); // ← No dependencies = runs EVERY render

// AFTER
useEffect(() => {
  socket.emit("join", `session:${sessionId}`);
  // ...
}, [socket, sessionId]); // ← Only runs when these change
```

---

### **Problem 3: Wrong Gemini Model Name** ❌

**Issue:** API returned 404 because model name was incorrect.

**Error:**

```
models/gemini-1.5-flash is not found for API version v1beta
```

**Fix:** Changed to `"gemini-1.5-flash-latest"` (correct format).

---

## ✅ **How to Verify It's Working**

### **1. Check Browser Console**

You should see:

```
[TranscriptView] Joining session room: abc-123-xyz
Socket.io connected: xyz789
```

You should NOT see infinite join/leave messages.

### **2. Check Server Logs**

You should see:

```
[Recording] Queueing transcription for chunk 0
[Worker] Starting transcription: chunk=abc_0000, session=abc-123, seq=0
[Worker] Transcribing chunk 0...
[Gemini] Transcription successful: 234 chars, confidence=0.95
```

### **3. Check Database**

```bash
npx prisma studio
```

Open `TranscriptChunk` table. You should see:

- `status`: "completed" (not "uploaded" or "processing")
- `text`: Actual transcribed text (not null)
- `confidence`: Between 0 and 1

### **4. Check Network Tab**

Open DevTools → Network → WS (WebSocket)

You should see:

```
← transcript-updated { sequence: 0, text: "...", ... }
← transcript-updated { sequence: 1, text: "...", ... }
```

---

## 🚀 **Testing the Flow**

### **Step-by-Step Test**

1. **Start Recording**

   ```
   Click "Start Recording" button
   → Session created
   → Room joined
   ```

2. **Speak for 30+ seconds**

   ```
   First chunk sent at 30s mark
   → Server saves chunk
   → Worker queues transcription
   ```

3. **Wait for Gemini (2-5 seconds)**

   ```
   Worker calls Gemini API
   → Receives transcript
   → Broadcasts to room
   ```

4. **Check UI**

   ```
   Transcript appears in TranscriptView
   → Text visible on screen
   → Sequence number shown
   ```

5. **Continue Recording**
   ```
   Second chunk at 60s
   → Process repeats
   → New transcript appends
   ```

---

## 🔍 **Debugging Commands**

### **Check if chunks are being received:**

```bash
# Server logs
grep "Queueing transcription" logs/*
```

### **Check if worker is processing:**

```bash
# Server logs
grep "Starting transcription" logs/*
```

### **Check if Gemini is being called:**

```bash
# Server logs
grep "Gemini" logs/*
```

### **Check database for transcripts:**

```sql
SELECT id, sessionId, seq, status, LEFT(text, 50) as text_preview
FROM "TranscriptChunk"
ORDER BY seq;
```

---

## 📝 **Summary**

### **What Fixed Your Issue:**

1. ✅ **Added `queueTranscription()` call** in `recording.ts`
2. ✅ **Fixed TranscriptView dependencies** to stop join/leave loop
3. ✅ **Corrected Gemini model name** to `"gemini-1.5-flash-latest"`

### **The Flow Now:**

```
Audio → Chunk → Save → Queue → Transcribe → Broadcast → Display
  30s    ↓       ↓      ↓        ↓           ↓           ↓
       Socket  File   Worker   Gemini    Socket.io     React
```

### **Expected Timeline:**

- **T+0s**: User starts recording
- **T+30s**: First chunk sent
- **T+31s**: Chunk saved, transcription queued
- **T+33s**: Gemini returns transcript
- **T+34s**: Transcript appears on screen ✨
- **T+60s**: Second chunk, repeat...

---

## 🎉 **Try It Now!**

1. Refresh your browser
2. Click "Start Recording"
3. **Speak clearly for at least 30 seconds**
4. Wait 3-5 seconds after the 30s mark
5. **You should see your transcript appear!**

If it doesn't work, check the debugging steps above and look for error messages in:

- Browser console (F12)
- Server terminal
- Database (`npx prisma studio`)
