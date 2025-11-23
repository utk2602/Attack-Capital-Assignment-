# ScribeAI Project Structure

This document outlines the directory structure of the ScribeAI application and the responsibilities of each folder.

## Root Directory

- **`server/`**: Backend Node.js application (Socket.io server, workers, processors).
- **`src/`**: Frontend Next.js application (UI, API routes, hooks).
- **`prisma/`**: Database schema, migrations, and seed scripts.
- **`scripts/`**: Utility scripts for testing, load generation, and maintenance.
- **`docs/`**: Project documentation.
- **`storage/`**: Local storage for audio chunks (in development).

## Detailed Breakdown

### `server/` (Backend)

The backend handles real-time socket connections, audio processing, and AI integration.

- **`server.ts`**: Entry point for the backend server. Initializes Socket.io and HTTP server.
- **`sockets/`**: Socket.io event handlers.
  - `recording.ts`: Handles `start-session`, `audio-chunk`, `stop-session` events.
- **`workers/`**: Background workers for heavy tasks.
  - `transcription.worker.ts`: Processes audio chunks via Gemini API.
  - `retention.worker.ts`: Manages data cleanup policies.
- **`processors/`**: Business logic for data processing.
  - `summary.ts`: Generates session summaries.
  - `diarization.ts`: Handles speaker separation logic.
  - `finalize.ts`: Finalizes sessions after recording stops.
- **`queues/`**: Queue management (if using BullMQ or similar, currently simple in-memory/async).
  - `simple-queue.ts`: Basic queue implementation.
- **`utils/`**: Shared backend utilities.
  - `geminiCostTracker.ts`: Tracks API usage and costs.
  - `exportFormats.ts`: Converts transcripts to SRT/VTT/JSON.
  - `ffmpeg.ts`: Audio conversion utilities.
  - `logger.ts`: Centralized logging.
- **`schemas/`**: Zod schemas for validation.

### `src/` (Frontend)

The frontend is a Next.js 14+ application using the App Router.

- **`app/`**: Next.js App Router pages and API routes.
  - `api/`: Backend-for-Frontend (BFF) API routes (auth, sessions, exports).
  - `auth/`: Authentication pages.
  - `history/`: Session history view.
  - `page.tsx`: Main landing/recording page.
- **`components/`**: Reusable React components.
  - `AudioPlayer.tsx`: Custom audio player.
  - `TranscriptView.tsx`: Real-time transcript display.
  - `ConfidenceIndicator.tsx`: Visual confidence metrics.
  - `ExportButtons.tsx`: Download options.
- **`lib/`**: Frontend utilities and configuration.
  - `audioRecorder.ts`: Browser MediaRecorder wrapper.
  - `gemini.ts`: Client-side Gemini helpers (if any).
  - `db.ts`: Prisma client instance.
- **`hooks/`**: Custom React hooks.
  - `useAudioRecorder.ts`: Manages recording state.
  - `useSocket.ts`: Manages socket connection.

### `prisma/` (Database)

- **`schema.prisma`**: Defines the data model (User, Session, TranscriptChunk, RecordingEvent).
- **`migrations/`**: SQL migration files.
- **`seed.ts`**: Database seeding script.

### `scripts/` (Tools)

- **`cleanup-sessions.ts`**: Database cleanup script for old sessions.

## Refactoring Suggestions

The current structure is already quite modular. Future improvements could include:

1. **Shared Types**: Create a `shared/` or `types/` package for types used by both server and client (e.g., Socket events).
2. **Service Layer**: Extract business logic from Next.js API routes into a dedicated service layer in `src/services/` to mirror the backend structure.
