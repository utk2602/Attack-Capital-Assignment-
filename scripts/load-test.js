/**
 * Load Test: Concurrent Recording Clients
 *
 * Simulates 20 concurrent clients streaming audio chunks for 10 minutes
 * Each client sends 30-second chunks
 *
 * Usage: node scripts/load-test.js
 */

const { io } = require("socket.io-client");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const NUM_CLIENTS = 20;
const TEST_DURATION_MS = 10 * 60 * 1000; // 10 minutes
const CHUNK_INTERVAL_MS = 5000; // 5 seconds per chunk
const CHUNK_SIZE_BYTES = 32000; // ~30KB per chunk (5s of audio)

class LoadTestClient {
  constructor(clientId) {
    this.clientId = clientId;
    this.socket = null;
    this.sessionId = null;
    this.chunksUploaded = 0;
    this.chunksTranscribed = 0;
    this.errors = 0;
    this.startTime = null;
    this.isRunning = false;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.socket = io(BASE_URL, {
        transports: ["websocket"],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      this.socket.on("connect", () => {
        console.log(`[Client ${this.clientId}] Connected`);
        resolve();
      });

      this.socket.on("connect_error", (err) => {
        console.error(`[Client ${this.clientId}] Connection error:`, err.message);
        this.errors++;
        reject(err);
      });

      this.socket.on("disconnect", (reason) => {
        console.log(`[Client ${this.clientId}] Disconnected: ${reason}`);
      });

      this.socket.on("session-created", (data) => {
        this.sessionId = data.sessionId;
        console.log(`[Client ${this.clientId}] Session created: ${this.sessionId}`);
      });

      this.socket.on("transcript-updated", (data) => {
        this.chunksTranscribed++;
      });

      this.socket.on("error", (error) => {
        console.error(`[Client ${this.clientId}] Socket error:`, error);
        this.errors++;
      });

      setTimeout(() => {
        if (!this.socket.connected) {
          reject(new Error("Connection timeout"));
        }
      }, 10000);
    });
  }

  async startRecording() {
    return new Promise((resolve) => {
      this.socket.emit("start-session", {
        userId: `load-test-user-${this.clientId}`,
        audioSource: "mic",
      });

      // Wait for session creation
      const checkSession = setInterval(() => {
        if (this.sessionId) {
          clearInterval(checkSession);
          resolve();
        }
      }, 100);

      setTimeout(() => {
        clearInterval(checkSession);
        if (!this.sessionId) {
          console.warn(`[Client ${this.clientId}] No session created after 5s`);
          this.errors++;
        }
        resolve();
      }, 5000);
    });
  }

  generateFakeAudioChunk(seq) {
    // Generate fake audio data (random bytes)
    const buffer = Buffer.alloc(CHUNK_SIZE_BYTES);
    for (let i = 0; i < CHUNK_SIZE_BYTES; i++) {
      buffer[i] = Math.floor(Math.random() * 256);
    }
    return buffer;
  }

  async uploadChunk(seq) {
    if (!this.sessionId) return;

    const audioData = this.generateFakeAudioChunk(seq);

    this.socket.emit("audio-chunk", {
      sessionId: this.sessionId,
      sequence: seq,
      audioData: audioData.toString("base64"),
      timestamp: Date.now(),
    });

    this.chunksUploaded++;
  }

  async run(duration) {
    this.isRunning = true;
    this.startTime = Date.now();

    await this.startRecording();

    let seq = 0;
    const chunkInterval = setInterval(() => {
      if (!this.isRunning) {
        clearInterval(chunkInterval);
        return;
      }

      this.uploadChunk(seq++);
    }, CHUNK_INTERVAL_MS);

    // Run for specified duration
    await new Promise((resolve) => setTimeout(resolve, duration));

    clearInterval(chunkInterval);
    this.isRunning = false;

    // Stop session
    if (this.sessionId) {
      this.socket.emit("stop-session", { sessionId: this.sessionId });
    }

    // Give server time to process final chunks
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  getStats() {
    const durationSeconds = this.startTime ? (Date.now() - this.startTime) / 1000 : 0;

    return {
      clientId: this.clientId,
      sessionId: this.sessionId,
      durationSeconds: Math.round(durationSeconds),
      chunksUploaded: this.chunksUploaded,
      chunksTranscribed: this.chunksTranscribed,
      errors: this.errors,
      uploadRate: durationSeconds > 0 ? (this.chunksUploaded / durationSeconds).toFixed(2) : 0,
      transcriptionRate:
        this.chunksUploaded > 0
          ? ((this.chunksTranscribed / this.chunksUploaded) * 100).toFixed(1)
          : 0,
    };
  }
}

async function runLoadTest() {
  console.log("=".repeat(60));
  console.log("LOAD TEST: Concurrent Recording Clients");
  console.log("=".repeat(60));
  console.log(`Server: ${BASE_URL}`);
  console.log(`Clients: ${NUM_CLIENTS}`);
  console.log(`Duration: ${TEST_DURATION_MS / 1000}s`);
  console.log(`Chunk interval: ${CHUNK_INTERVAL_MS / 1000}s`);
  console.log(`Chunk size: ${CHUNK_SIZE_BYTES} bytes`);
  console.log("=".repeat(60));
  console.log("");

  const clients = [];
  const testStartTime = Date.now();

  // Create and connect all clients
  console.log("Connecting clients...");
  for (let i = 1; i <= NUM_CLIENTS; i++) {
    const client = new LoadTestClient(i);
    clients.push(client);
  }

  // Connect in batches to avoid overwhelming the server
  const BATCH_SIZE = 5;
  for (let i = 0; i < clients.length; i += BATCH_SIZE) {
    const batch = clients.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map((c) =>
        c.connect().catch((err) => {
          console.error(`Failed to connect client ${c.clientId}:`, err.message);
        })
      )
    );
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Stagger batches
  }

  const connectedClients = clients.filter((c) => c.socket && c.socket.connected);
  console.log(`\nConnected: ${connectedClients.length}/${NUM_CLIENTS} clients\n`);

  // Run test
  console.log("Starting load test...\n");
  await Promise.all(connectedClients.map((client) => client.run(TEST_DURATION_MS)));

  const testDurationSeconds = (Date.now() - testStartTime) / 1000;

  // Collect statistics
  console.log("\n" + "=".repeat(60));
  console.log("TEST RESULTS");
  console.log("=".repeat(60));
  console.log(`Test duration: ${testDurationSeconds.toFixed(1)}s\n`);

  let totalChunks = 0;
  let totalTranscribed = 0;
  let totalErrors = 0;

  console.log("Per-Client Stats:");
  console.log("-".repeat(60));
  clients.forEach((client) => {
    const stats = client.getStats();
    console.log(
      `Client ${stats.clientId.toString().padStart(2)}: ` +
        `${stats.chunksUploaded} chunks uploaded, ` +
        `${stats.chunksTranscribed} transcribed (${stats.transcriptionRate}%), ` +
        `${stats.errors} errors`
    );

    totalChunks += stats.chunksUploaded;
    totalTranscribed += stats.chunksTranscribed;
    totalErrors += stats.errors;
  });

  console.log("\n" + "=".repeat(60));
  console.log("AGGREGATE STATS");
  console.log("=".repeat(60));
  console.log(`Total chunks uploaded: ${totalChunks}`);
  console.log(`Total chunks transcribed: ${totalTranscribed}`);
  console.log(
    `Transcription success rate: ${((totalTranscribed / totalChunks) * 100).toFixed(1)}%`
  );
  console.log(`Total errors: ${totalErrors}`);
  console.log(`Average upload rate: ${(totalChunks / testDurationSeconds).toFixed(2)} chunks/sec`);
  console.log(
    `Total data transferred: ${((totalChunks * CHUNK_SIZE_BYTES) / 1024 / 1024).toFixed(2)} MB`
  );
  console.log("=".repeat(60));

  // Cleanup
  clients.forEach((client) => client.disconnect());

  process.exit(0);
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\nTest interrupted. Shutting down...");
  process.exit(0);
});

// Run test
runLoadTest().catch((err) => {
  console.error("Load test failed:", err);
  process.exit(1);
});
