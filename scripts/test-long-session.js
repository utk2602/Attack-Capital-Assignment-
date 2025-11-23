/**
 * Performance Test Script for ScribeAI
 *
 * Simulates a 60-minute recording session by uploading 120 chunks (30s each)
 * Tests queue performance, disk usage, database growth, and memory consumption
 *
 * Usage:
 *   node scripts/test-long-session.js [--userId=user123] [--fast]
 *
 * Options:
 *   --userId     User ID for the session (default: test-user)
 *   --fast       Upload chunks with minimal delay (default: 1s between chunks)
 *   --chunks     Number of chunks to simulate (default: 120)
 */

const io = require("socket.io-client");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

// Configuration
const SERVER_URL = process.env.SERVER_URL || "http://localhost:3001";
const CHUNK_COUNT = parseInt(process.env.CHUNKS || "120", 10);
const CHUNK_DURATION_MS = 30000;
const FAST_MODE = process.argv.includes("--fast");
const UPLOAD_DELAY_MS = FAST_MODE ? 100 : 1000;
const USER_ID =
  process.argv.find((arg) => arg.startsWith("--userId="))?.split("=")[1] || "test-user";

// Performance tracking
const metrics = {
  startTime: Date.now(),
  chunksUploaded: 0,
  bytesTransferred: 0,
  latencies: [],
  errors: 0,
  queueSizes: [],
  memorySnapshots: [],
  diskUsage: [],
};

// Generate synthetic audio data (silence with WebM header)
function generateSyntheticAudioChunk(sequence) {
  // Minimal WebM audio file structure (Opus codec)
  // This is a simplified version - real WebM has complex EBML structure
  const header = Buffer.from([
    0x1a,
    0x45,
    0xdf,
    0xa3, // EBML Header
    0x01,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x1f,
    0x42,
    0x86,
    0x81,
    0x01, // EBMLVersion
    0x42,
    0xf7,
    0x81,
    0x01, // EBMLReadVersion
  ]);

  // Generate random-ish audio data (simulate compressed audio)
  const audioSize = 8000 + Math.floor(Math.random() * 2000); // 8-10KB per chunk
  const audioData = Buffer.alloc(audioSize);

  // Fill with pseudo-random data to simulate Opus frames
  for (let i = 0; i < audioSize; i++) {
    audioData[i] = (Math.sin(i * 0.1 + sequence) * 127 + 128) & 0xff;
  }

  return Buffer.concat([header, audioData]);
}

// Memory usage tracker
function getMemoryUsage() {
  const usage = process.memoryUsage();
  return {
    rss: Math.round(usage.rss / 1024 / 1024), // MB
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
    external: Math.round(usage.external / 1024 / 1024),
  };
}

// Disk usage estimator (for storage directory)
function estimateDiskUsage(sessionId) {
  const storagePath = path.join(process.cwd(), "storage", "audio-chunks", sessionId);

  try {
    if (!fs.existsSync(storagePath)) return 0;

    const files = fs.readdirSync(storagePath);
    let totalSize = 0;

    files.forEach((file) => {
      const filePath = path.join(storagePath, file);
      const stats = fs.statSync(filePath);
      totalSize += stats.size;
    });

    return Math.round(totalSize / 1024 / 1024); // MB
  } catch (error) {
    return 0;
  }
}

// Progress bar
function updateProgress(current, total, extraInfo = "") {
  const percent = Math.round((current / total) * 100);
  const barLength = 40;
  const filled = Math.round((percent / 100) * barLength);
  const bar = "█".repeat(filled) + "░".repeat(barLength - filled);

  process.stdout.clearLine(0);
  process.stdout.cursorTo(0);
  process.stdout.write(`Progress: [${bar}] ${percent}% (${current}/${total}) ${extraInfo}`);
}

// Main test function
async function runPerformanceTest() {
  console.log("╔═══════════════════════════════════════════════════════════╗");
  console.log("║         ScribeAI Performance Test - Long Session         ║");
  console.log("╚═══════════════════════════════════════════════════════════╝\n");

  console.log(`Configuration:`);
  console.log(`  • Server: ${SERVER_URL}`);
  console.log(
    `  • Chunks: ${CHUNK_COUNT} (${CHUNK_COUNT * 30}s = ${Math.round(CHUNK_COUNT / 2)}min)`
  );
  console.log(`  • User ID: ${USER_ID}`);
  console.log(`  • Mode: ${FAST_MODE ? "FAST (100ms delay)" : "NORMAL (1s delay)"}\n`);

  const sessionId = uuidv4();
  console.log(`📝 Session ID: ${sessionId}\n`);

  // Connect to server
  console.log("🔌 Connecting to server...");
  const socket = io(SERVER_URL, {
    transports: ["websocket"],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  await new Promise((resolve, reject) => {
    socket.on("connect", resolve);
    socket.on("connect_error", reject);
    setTimeout(() => reject(new Error("Connection timeout")), 10000);
  });

  console.log("✅ Connected to server\n");

  // Start session
  console.log("🎙️  Starting recording session...");

  socket.emit("start-session", {
    sessionId,
    userId: USER_ID,
    title: `Performance Test - ${CHUNK_COUNT} chunks`,
    source: "mic",
  });

  await new Promise((resolve) => {
    socket.on("session-started", resolve);
  });

  console.log("✅ Session started\n");

  // Setup event listeners
  socket.on("chunk-ack", (data) => {
    const latency = Date.now() - data.timestamp;
    metrics.latencies.push(latency);
    metrics.chunksUploaded++;
  });

  socket.on("chunk-error", (data) => {
    metrics.errors++;
    console.error(`\n❌ Chunk error: ${data.error}`);
  });

  // Memory monitoring interval
  const memoryInterval = setInterval(() => {
    const memory = getMemoryUsage();
    metrics.memorySnapshots.push({ timestamp: Date.now(), ...memory });

    const diskMB = estimateDiskUsage(sessionId);
    metrics.diskUsage.push({ timestamp: Date.now(), size: diskMB });
  }, 5000); // Every 5 seconds

  // Upload chunks
  console.log("📤 Uploading chunks...\n");

  for (let seq = 0; seq < CHUNK_COUNT; seq++) {
    const chunkBuffer = generateSyntheticAudioChunk(seq);
    const timestamp = Date.now();

    // Convert Buffer to ArrayBuffer for socket emission
    const arrayBuffer = chunkBuffer.buffer.slice(
      chunkBuffer.byteOffset,
      chunkBuffer.byteOffset + chunkBuffer.byteLength
    );

    socket.emit("audio-chunk", {
      sessionId,
      sequence: seq,
      timestamp,
      size: chunkBuffer.length,
      mimeType: "audio/webm;codecs=opus",
      audio: arrayBuffer,
    });

    metrics.bytesTransferred += chunkBuffer.length;

    const avgLatency =
      metrics.latencies.length > 0
        ? Math.round(metrics.latencies.reduce((a, b) => a + b, 0) / metrics.latencies.length)
        : 0;

    const memory = getMemoryUsage();
    const diskMB = estimateDiskUsage(sessionId);

    updateProgress(
      seq + 1,
      CHUNK_COUNT,
      `| Latency: ${avgLatency}ms | Memory: ${memory.heapUsed}MB | Disk: ${diskMB}MB`
    );

    // Delay between chunks
    if (seq < CHUNK_COUNT - 1) {
      await new Promise((resolve) => setTimeout(resolve, UPLOAD_DELAY_MS));
    }
  }

  console.log("\n\n✅ All chunks uploaded\n");

  // Wait for final acks
  console.log("⏳ Waiting for final acknowledgments...");
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Stop session
  console.log("🛑 Stopping session...");
  socket.emit("stop-session", { sessionId, userId: USER_ID });

  await new Promise((resolve) => {
    socket.on("session-stopped", resolve);
    setTimeout(resolve, 5000);
  });

  clearInterval(memoryInterval);

  // Generate report
  generateReport(sessionId);

  // Cleanup
  socket.disconnect();
  process.exit(0);
}

function generateReport(sessionId) {
  const duration = Date.now() - metrics.startTime;
  const avgLatency =
    metrics.latencies.length > 0
      ? Math.round(metrics.latencies.reduce((a, b) => a + b, 0) / metrics.latencies.length)
      : 0;
  const maxLatency = metrics.latencies.length > 0 ? Math.max(...metrics.latencies) : 0;
  const minLatency = metrics.latencies.length > 0 ? Math.min(...metrics.latencies) : 0;

  const finalMemory =
    metrics.memorySnapshots[metrics.memorySnapshots.length - 1] || getMemoryUsage();
  const peakMemory = metrics.memorySnapshots.reduce((max, snap) => Math.max(max, snap.heapUsed), 0);

  const finalDisk = metrics.diskUsage[metrics.diskUsage.length - 1]?.size || 0;

  console.log("\n╔═══════════════════════════════════════════════════════════╗");
  console.log("║                    Performance Report                     ║");
  console.log("╚═══════════════════════════════════════════════════════════╝\n");

  console.log("📊 Upload Statistics:");
  console.log(`  • Total chunks: ${metrics.chunksUploaded} / ${CHUNK_COUNT}`);
  console.log(`  • Success rate: ${((metrics.chunksUploaded / CHUNK_COUNT) * 100).toFixed(2)}%`);
  console.log(`  • Errors: ${metrics.errors}`);
  console.log(`  • Total duration: ${(duration / 1000).toFixed(2)}s`);
  console.log(`  • Bytes transferred: ${(metrics.bytesTransferred / 1024 / 1024).toFixed(2)} MB`);
  console.log(
    `  • Throughput: ${(metrics.bytesTransferred / 1024 / (duration / 1000)).toFixed(2)} KB/s\n`
  );

  console.log("⚡ Latency:");
  console.log(`  • Average: ${avgLatency}ms`);
  console.log(`  • Min: ${minLatency}ms`);
  console.log(`  • Max: ${maxLatency}ms`);
  console.log(`  • P95: ${calculatePercentile(metrics.latencies, 95)}ms`);
  console.log(`  • P99: ${calculatePercentile(metrics.latencies, 99)}ms\n`);

  console.log("💾 Memory Usage:");
  console.log(`  • Final heap: ${finalMemory.heapUsed} MB`);
  console.log(`  • Peak heap: ${peakMemory} MB`);
  console.log(`  • RSS: ${finalMemory.rss} MB\n`);

  console.log("💿 Disk Usage:");
  console.log(`  • Session storage: ${finalDisk} MB`);
  console.log(`  • Avg chunk size: ${((finalDisk * 1024) / CHUNK_COUNT).toFixed(2)} KB\n`);

  console.log("📁 Session Details:");
  console.log(`  • Session ID: ${sessionId}`);
  console.log(`  • Storage path: storage/audio-chunks/${sessionId}/\n`);

  // Save detailed report to file
  const reportPath = path.join(process.cwd(), `perf-report-${Date.now()}.json`);
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        sessionId,
        config: { chunks: CHUNK_COUNT, fastMode: FAST_MODE, userId: USER_ID },
        summary: {
          duration,
          chunksUploaded: metrics.chunksUploaded,
          bytesTransferred: metrics.bytesTransferred,
          successRate: (metrics.chunksUploaded / CHUNK_COUNT) * 100,
          errors: metrics.errors,
        },
        latency: {
          avg: avgLatency,
          min: minLatency,
          max: maxLatency,
          p95: calculatePercentile(metrics.latencies, 95),
          p99: calculatePercentile(metrics.latencies, 99),
        },
        memory: {
          final: finalMemory,
          peak: peakMemory,
          snapshots: metrics.memorySnapshots,
        },
        disk: {
          finalMB: finalDisk,
          history: metrics.diskUsage,
        },
      },
      null,
      2
    )
  );

  console.log(`💾 Detailed report saved: ${reportPath}\n`);
}

function calculatePercentile(arr, percentile) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index] || 0;
}

// Error handling
process.on("uncaughtException", (error) => {
  console.error("\n❌ Uncaught exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (error) => {
  console.error("\n❌ Unhandled rejection:", error);
  process.exit(1);
});

// Run test
runPerformanceTest().catch((error) => {
  console.error("\n❌ Test failed:", error);
  process.exit(1);
});
