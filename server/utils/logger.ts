import winston from "winston";
import path from "path";

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "HH:mm:ss" }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}] ${message}`;

    if (Object.keys(meta).length > 0) {
      const cleanMeta = Object.fromEntries(
        Object.entries(meta).filter(
          ([key, value]) =>
            value !== undefined &&
            value !== null &&
            !key.startsWith("_") &&
            key !== "timestamp" &&
            key !== "level"
        )
      );

      if (Object.keys(cleanMeta).length > 0) {
        msg += ` ${JSON.stringify(cleanMeta)}`;
      }
    }

    return msg;
  })
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: logFormat,
  defaultMeta: { service: "scribeai-server" },
  transports: [
    new winston.transports.Console({
      format: consoleFormat,
      level: process.env.NODE_ENV === "production" ? "info" : "debug",
    }),

    new winston.transports.File({
      filename: path.join(process.cwd(), "logs", "combined.log"),
      level: "info",
    }),

    
    new winston.transports.File({
      filename: path.join(process.cwd(), "logs", "error.log"),
      level: "error",
    }),
  ],
});


export const chunkLogger = {

  received: (data: {
    sessionId: string;
    sequence: number;
    userId: string;
    size: number;
    durationMs: number;
    mimeType?: string;
  }) => {
    logger.info("Chunk received", {
      event: "chunk_received",
      sessionId: data.sessionId,
      sequence: data.sequence,
      userId: data.userId,
      size: data.size,
      durationMs: data.durationMs,
      mimeType: data.mimeType,
      sizeKB: (data.size / 1024).toFixed(2),
    });
  },

  processed: (data: {
    sessionId: string;
    sequence: number;
    chunkId: string;
    processingTimeMs: number;
    audioPath: string;
  }) => {
    logger.info("Chunk processed", {
      event: "chunk_processed",
      sessionId: data.sessionId,
      sequence: data.sequence,
      chunkId: data.chunkId,
      processingTimeMs: data.processingTimeMs,
      audioPath: data.audioPath,
    });
  },


  error: (data: {
    sessionId: string;
    sequence: number;
    error: Error | string;
    userId?: string;
  }) => {
    logger.error("Chunk processing failed", {
      event: "chunk_error",
      sessionId: data.sessionId,
      sequence: data.sequence,
      userId: data.userId,
      error: data.error instanceof Error ? data.error.message : data.error,
      stack: data.error instanceof Error ? data.error.stack : undefined,
    });
  },

  
  validationError: (data: {
    sessionId?: string;
    sequence?: number;
    validationErrors: string;
    rawData?: any;
  }) => {
    logger.warn("Chunk validation failed", {
      event: "chunk_validation_error",
      sessionId: data.sessionId,
      sequence: data.sequence,
      validationErrors: data.validationErrors,
      rawDataKeys: data.rawData ? Object.keys(data.rawData) : undefined,
    });
  },
};


export const sessionLogger = {
 
  started: (data: { sessionId: string; userId: string; source?: string; title?: string }) => {
    logger.info("Session started", {
      event: "session_started",
      sessionId: data.sessionId,
      userId: data.userId,
      source: data.source || "mic",
      title: data.title,
    });
  },

  
  paused: (data: { sessionId: string; pausedAt: number }) => {
    logger.info("Session paused", {
      event: "session_paused",
      sessionId: data.sessionId,
      pausedAt: new Date(data.pausedAt).toISOString(),
    });
  },

  resumed: (data: { sessionId: string; resumedAt: number }) => {
    logger.info("Session resumed", {
      event: "session_resumed",
      sessionId: data.sessionId,
      resumedAt: new Date(data.resumedAt).toISOString(),
    });
  },

 
  completed: (data: {
    sessionId: string;
    userId?: string;
    totalChunks?: number;
    durationSeconds?: number;
  }) => {
    logger.info("Session completed", {
      event: "session_completed",
      sessionId: data.sessionId,
      userId: data.userId,
      totalChunks: data.totalChunks,
      durationSeconds: data.durationSeconds,
    });
  },


  error: (data: { sessionId: string; error: Error | string; operation?: string }) => {
    logger.error("Session error", {
      event: "session_error",
      sessionId: data.sessionId,
      operation: data.operation,
      error: data.error instanceof Error ? data.error.message : data.error,
      stack: data.error instanceof Error ? data.error.stack : undefined,
    });
  },
};


export const socketLogger = {
  connected: (socketId: string, metadata?: Record<string, any>) => {
    logger.info("Socket connected", {
      event: "socket_connected",
      socketId,
      ...metadata,
    });
  },

  disconnected: (socketId: string, reason: string) => {
    logger.info("Socket disconnected", {
      event: "socket_disconnected",
      socketId,
      reason,
    });
  },

  error: (socketId: string, error: Error | string) => {
    logger.error("Socket error", {
      event: "socket_error",
      socketId,
      error: error instanceof Error ? error.message : error,
    });
  },
};

import fs from "fs";
const logsDir = path.join(process.cwd(), "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

export default logger;
