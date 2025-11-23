# ScribeAI Architecture

## System Pipeline

```mermaid
graph TD
    Client[Client (Next.js)] -->|Audio Chunk (5s)| Socket[Socket.io Server]
    Socket -->|Save to Disk| Storage[Local Storage]
    Socket -->|Queue Job| Queue[Redis/Memory Queue]

    subgraph "Worker Layer"
        Queue -->|Process| Worker[Transcription Worker]
        Worker -->|Convert| FFmpeg[FFmpeg (WebM -> WAV)]
        FFmpeg -->|WAV| Gemini[Gemini 1.5 Pro]
    end

    Gemini -->|Transcript JSON| DB[(PostgreSQL)]
    DB -->|Update Event| Socket
    Socket -->|Real-time Update| Client

    subgraph "Post-Processing"
        DB -->|Session Complete| SummaryProcessor[Summary Processor]
        SummaryProcessor -->|Full Transcript| Gemini
        Gemini -->|Summary & Action Items| DB
    end
```

## Scalability & Trade-offs

**Long-Session Scalability Strategy**

ScribeAI adopts a **client-side chunking** strategy rather than server-side buffering or continuous streaming. This decision was driven by the need to support long-running sessions (1+ hours) without memory leaks or connection timeouts.

By slicing audio into 5-second chunks on the client:

1. **Memory Efficiency**: The server never holds the full audio file in RAM. Each chunk is processed independently and stateless-ly.
2. **Resilience**: If a network drop occurs, only the current 5-second chunk is at risk, not the entire recording. The client can retry uploading specific chunks.
3. **Concurrency**: Multiple chunks can be processed in parallel by a pool of workers, reducing the "catch-up" time after a long recording.

**Trade-offs**:

- **Pros**: High reliability, horizontal scalability (workers can be distributed), fault tolerance.
- **Cons**: Higher latency than true streaming (WebRTC), potential for "cut-off" words at chunk boundaries (mitigated by overlapping or context-aware prompting), increased API call overhead.

Server-side buffering was rejected because it requires sticky sessions and large memory allocation per user, which limits the number of concurrent active sessions a single node can handle.

## Architecture Comparison

| Feature            | WebRTC Streaming            | MediaRecorder Chunking (ScribeAI) | Full File Upload             |
| :----------------- | :-------------------------- | :-------------------------------- | :--------------------------- |
| **Latency**        | Ultra-low (<500ms)          | Low (2-5s)                        | High (Post-recording)        |
| **Reliability**    | Fragile (UDP packet loss)   | High (HTTP/TCP retries)           | Medium (Upload failure risk) |
| **Bandwidth**      | Constant stream             | Bursty (every 5s)                 | Huge spike at end            |
| **Server Load**    | High (Stateful connections) | Medium (Stateless processing)     | Low (Batch processing)       |
| **Dev Complexity** | High (Signaling, TURN/STUN) | Medium (Socket.io + Blobs)        | Low (Simple HTTP POST)       |
| **AI Integration** | Complex (Stream-to-text)    | Simple (File-to-text API)         | Simple (File-to-text API)    |

ScribeAI chose **MediaRecorder Chunking** as the "Goldilocks" solution: it offers near-real-time feedback (unlike full upload) but uses standard HTTP/TCP reliability (unlike WebRTC), making it ideal for critical business documentation where accuracy and completeness outweigh sub-second latency.
