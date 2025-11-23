# Quick Start Guide - Modular Architecture

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                   Client (Browser)                   │
│  ┌──────────────┐  ┌─────────────┐  ┌─────────────┐│
│  │ RecordingUI  │  │ TranscriptUI│  │   Socket    ││
│  └──────┬───────┘  └──────┬──────┘  └──────┬──────┘│
└─────────┼──────────────────┼─────────────────┼──────┘
          │                  │                 │
          └──────────────────┴─────────────────┘
                             │
                    ┌────────▼────────┐
                    │  Socket.io      │
                    │  (with cookies) │
                    └────────┬────────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
     ┌────▼─────┐     ┌──────▼──────┐    ┌─────▼─────┐
     │ Socket   │     │  Session    │    │   Chunk   │
     │ Manager  │     │  Manager    │    │  Manager  │
     └────┬─────┘     └──────┬──────┘    └─────┬─────┘
          │                  │                  │
          └──────────────────┴──────────────────┘
                             │
                    ┌────────▼────────┐
                    │   PostgreSQL    │
                    │   + Prisma      │
                    └─────────────────┘
```

## Manager Responsibilities

### 1. SocketManager

**Purpose:** Handle authentication and connection tracking

```typescript
// Authenticate user from cookies
const userId = await socketManager.authenticate(socket);

// Check auth status
if (socketManager.isAuthenticated(socket.id)) {
  // User is authenticated
}

// Get all sockets for a user
const userSockets = socketManager.getUserSockets(userId);

// Clean up on disconnect
socketManager.handleDisconnect(socket.id);
```

### 2. SessionManager

**Purpose:** Manage recording session lifecycle

```typescript
// Create new session
const session = await sessionManager.createSession({
  sessionId: crypto.randomUUID(),
  userId: "user_123",
  title: "Team Meeting",
  source: "mic",
});

// Get session details
const session = await sessionManager.getSession(sessionId);

// Verify ownership
const owns = await sessionManager.verifySession(sessionId, userId);

// Pause/Resume
await sessionManager.pauseSession(sessionId);
await sessionManager.resumeSession(sessionId);

// Complete session
await sessionManager.completeSession(sessionId, userId);
```

### 3. ChunkManager

**Purpose:** Process and store audio chunks

```typescript
// Process incoming chunk
const metadata = await chunkManager.processChunk(
  {
    sessionId,
    sequence: 1,
    timestamp: Date.now(),
    audioData: buffer,
    mimeType: "audio/webm",
  },
  socket
);

// Get all chunks
const chunks = await chunkManager.getSessionChunks(sessionId);

// Verify no chunks are missing
const { valid, missingSequences } = await chunkManager.verifyChunkSequence(sessionId);
```

## Event Flow

### Session Start

```
Client                Server
  │                     │
  ├─ start-session ────>│
  │                     │
  │              ┌──────▼──────┐
  │              │ Validate    │
  │              │ Rate Limit  │
  │              │ Create DB   │
  │              │ Join Room   │
  │              └──────┬──────┘
  │                     │
  │<──── session-started│
```

### Audio Chunk

```
Client                Server
  │                     │
  ├─ audio-chunk ──────>│
  │                     │
  │              ┌──────▼──────┐
  │              │ Validate    │
  │              │ Check Auth  │
  │              │ Save File   │
  │              │ Update DB   │
  │              │ Queue Trans │
  │              └──────┬──────┘
  │                     │
  │<────── chunk-ack ───┤
  │                     │
  │                ┌────▼─────┐
  │                │Transcribe│
  │                │(async)   │
  │                └────┬─────┘
  │                     │
  │<─transcript-updated─┤
```

### Session Stop

```
Client                Server
  │                     │
  ├─ stop-session ─────>│
  │                     │
  │              ┌──────▼──────┐
  │              │ Validate    │
  │              │ Update DB   │
  │              │ Cleanup     │
  │              └──────┬──────┘
  │                     │
  │<──── session-stopped│
  │                     │
  │              ┌──────▼──────┐
  │              │ Generate    │
  │              │ Summary     │
  │              │ (async)     │
  │              └──────┬──────┘
  │                     │
  │<─── summary-ready ──┤
```

## Client Integration

### Initialize Socket

```typescript
// In your component
const { isConnected, startSession, emitAudioChunk, stopSession } = useSocket({
  autoConnect: !!user, // Auto-connect when user is logged in
});
```

### Start Recording

```typescript
const sessionId = await startSession(userId, "Meeting Recording");
if (sessionId) {
  // Start capturing audio
  setCurrentSessionId(sessionId);
}
```

### Send Audio Chunks

```typescript
// Called by audio recorder
await emitAudioChunk(sessionId, sequence, timestamp, blob);
```

### Stop Recording

```typescript
await stopSession(sessionId);
// Summary will be generated automatically
```

## Database Schema

### RecordingSession

```prisma
model RecordingSession {
  id          String   @id
  userId      String
  title       String
  status      String   // "recording" | "paused" | "completed"
  startedAt   DateTime
  chunks      TranscriptChunk[]
}
```

### TranscriptChunk

```prisma
model TranscriptChunk {
  id        String  @id
  sessionId String
  seq       Int
  audioPath String
  text      String?
  speaker   String?
  status    String  // "uploaded" | "transcribing" | "completed"

  @@unique([sessionId, seq])
}
```

## Error Handling

### Client Side

```typescript
socket.on("session-error", (error) => {
  console.error("Session error:", error);
  // Show user-friendly message
  toast.error(error.error);
});

socket.on("chunk-error", (error) => {
  console.error("Chunk error:", error);
  // Retry or queue for later
});

socket.on("auth-error", (error) => {
  // Redirect to login
  router.push("/auth/sign-in");
});
```

### Server Side

```typescript
try {
  await sessionManager.createSession(config);
} catch (error) {
  if (error instanceof RateLimitError) {
    socket.emit("session-error", {
      error: error.message,
      code: "RATE_LIMIT",
    });
  } else {
    socket.emit("session-error", {
      error: "Internal error",
    });
  }
}
```

## Testing Checklist

- [ ] User can sign in successfully
- [ ] Socket connects after login
- [ ] Socket disconnects immediately if not authenticated
- [ ] Session can be created
- [ ] Audio chunks are received and saved
- [ ] Transcript appears in real-time
- [ ] Session can be paused and resumed
- [ ] Session can be stopped
- [ ] Summary is generated after stop
- [ ] Session data persists in database
- [ ] Multiple concurrent sessions work
- [ ] Duplicate chunks are handled (idempotency)
- [ ] Rate limiting works
- [ ] Backpressure prevents overload

## Debugging Tips

### Check Authentication

```bash
# Server logs
[Auth] Socket abc123 authenticated as user_456

# Client console
Socket.io connected: abc123
```

### Check Session Creation

```bash
# Server logs
[SessionManager] Session created: uuid-here

# Database
SELECT * FROM "RecordingSession" WHERE id = 'uuid-here';
```

### Check Chunk Processing

```bash
# Server logs
[ChunkManager] Chunk 1 saved: 2048 bytes
[Worker] Queued transcription for chunk 1

# File system
ls storage/audio-chunks/session-uuid/
```

### Check Real-time Updates

```bash
# Server logs
[Socket] abc123 joined room: session:uuid-here
[Broadcast] Sending transcript update to session:uuid-here

# Client console
Received transcript-updated: { sequence: 1, text: "..." }
```

## Common Commands

```bash
# Start development server
npm run dev

# Check TypeScript errors
npx tsc --noEmit

# Regenerate Prisma Client
npx prisma generate

# View database
npx prisma studio

# Run migrations
npx prisma migrate dev

# Format code
npm run format

# Kill process on port 3000 (Windows)
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process
```

## Environment Variables

```env
# Required
DATABASE_URL=postgresql://...
GEMINI_API_KEY=your_key_here

# Optional
NEXT_PUBLIC_SOCKET_URL=http://localhost:3000
NODE_ENV=development
```

## Performance Tips

1. **Batch Updates:** Group transcript updates instead of sending each word
2. **Chunk Size:** Keep audio chunks at 30s for optimal processing
3. **Connection Pool:** Adjust Prisma connection pool for concurrent users
4. **Rate Limiting:** Configure based on your server capacity
5. **Backpressure:** Monitor queue depth and reject if overloaded

## Security Considerations

1. **Authentication:** Always verify user owns the session
2. **Rate Limiting:** Prevent abuse with rate limits
3. **Input Validation:** Use Zod schemas for all socket events
4. **File Storage:** Sanitize session IDs to prevent directory traversal
5. **CORS:** Configure properly for production
6. **Cookies:** Use secure, httpOnly cookies in production

## Deployment

1. Build the application

   ```bash
   npm run build
   ```

2. Run migrations

   ```bash
   npx prisma migrate deploy
   ```

3. Start production server

   ```bash
   npm start
   ```

4. Configure reverse proxy (Nginx/Caddy)
   - Forward `/socket.io/` to Node.js server
   - Enable WebSocket upgrade
   - Pass cookies to backend

## Support

For issues:

1. Check server logs
2. Check browser console
3. Verify database state
4. Test with curl/Postman
5. Review recent code changes

Happy coding! 🚀
