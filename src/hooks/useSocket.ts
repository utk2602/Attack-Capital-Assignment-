"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

interface UseSocketOptions {
  /**
   * Socket.io server URL
   * @default "http://localhost:3000"
   */
  url?: string;

  token?: string;

  /**
   * Auto-connect on mount
   * @default true
   */
  autoConnect?: boolean;
}

interface QueuedChunk {
  sessionId: string;
  sequence: number;
  timestamp: number;
  blob: Blob;
  retryCount: number;
  queuedAt: number;
}

export function useSocket(options: UseSocketOptions = {}) {
  const {
    url = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3000",
    token,
    autoConnect = true,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queuedChunks, setQueuedChunks] = useState<number>(0);
  const [failedChunks, setFailedChunks] = useState<number>(0);
  const socketRef = useRef<Socket | null>(null);
  const chunkQueueRef = useRef<QueuedChunk[]>([]);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingQueueRef = useRef(false);

  useEffect(() => {
    if (!autoConnect) return;

    //  socket connection
    const socket = io(url, {
      auth: token ? { token } : undefined,
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    // Connection event handlers
    socket.on("connect", () => {
      console.log("Socket.io connected:", socket.id);
      setIsConnected(true);
      setError(null);

      // Process queued chunks on reconnect
      processQueuedChunks();
    });

    socket.on("disconnect", (reason) => {
      console.log("Socket.io disconnected:", reason);
      setIsConnected(false);
    });

    socket.on("connect_error", (err) => {
      console.error("Socket.io connection error:", err);
      setError(err.message);
      setIsConnected(false);
    });

    //unmount
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [url, token, autoConnect]);

  
  const processQueuedChunks = useCallback(async () => {
    if (isProcessingQueueRef.current || chunkQueueRef.current.length === 0) {
      return;
    }

    isProcessingQueueRef.current = true;
    const queue = [...chunkQueueRef.current];

    for (const queuedChunk of queue) {
      if (!socketRef.current?.connected) {
        console.log("Socket disconnected, stopping queue processing");
        break;
      }

      try {
        const backoffDelay = Math.min(1000 * Math.pow(2, queuedChunk.retryCount), 30000);

        if (queuedChunk.retryCount > 0) {
          console.log(
            `Retrying chunk ${queuedChunk.sequence} (attempt ${queuedChunk.retryCount + 1}) after ${backoffDelay}ms`
          );
          await new Promise((resolve) => setTimeout(resolve, backoffDelay));
        }

        const arrayBuffer = await queuedChunk.blob.arrayBuffer();

        await new Promise<void>((resolve, reject) => {
          socketRef.current?.emit(
            "audio-chunk",
            {
              sessionId: queuedChunk.sessionId,
              sequence: queuedChunk.sequence,
              timestamp: queuedChunk.timestamp,
              size: queuedChunk.blob.size,
              mimeType: queuedChunk.blob.type,
              audio: arrayBuffer,
            },
            (ack: any) => {
              if (ack?.error) {
                reject(new Error(ack.error));
              } else {
                resolve();
              }
            }
          );

          setTimeout(() => reject(new Error("Chunk emit timeout")), 10000);
        });

        chunkQueueRef.current = chunkQueueRef.current.filter(
          (c) => c.sequence !== queuedChunk.sequence || c.sessionId !== queuedChunk.sessionId
        );
        setQueuedChunks(chunkQueueRef.current.length);

        console.log(`✅ Successfully sent queued chunk ${queuedChunk.sequence}`);
      } catch (error) {
        console.error(`Failed to send queued chunk ${queuedChunk.sequence}:`, error);

        const chunkIndex = chunkQueueRef.current.findIndex(
          (c) => c.sequence === queuedChunk.sequence && c.sessionId === queuedChunk.sessionId
        );

        if (chunkIndex !== -1) {
          chunkQueueRef.current[chunkIndex].retryCount += 1;

          if (chunkQueueRef.current[chunkIndex].retryCount >= 5) {
            console.error(`❌ Giving up on chunk ${queuedChunk.sequence} after 5 retries`);
            chunkQueueRef.current.splice(chunkIndex, 1);
            setFailedChunks((prev) => prev + 1);
          }
        }

        setQueuedChunks(chunkQueueRef.current.length);
      }
    }

    isProcessingQueueRef.current = false;
  }, []);

  
  const emit = useCallback((event: string, data: any) => {
    if (!socketRef.current) {
      console.warn("Socket not connected");
      return;
    }
    socketRef.current.emit(event, data);
  }, []);

  /**
   * Start a new recording session
   *
   * @param userId - User ID
   * @param title - Session title
   * @returns Promise with session ID
   */
  const startSession = useCallback(
    async (userId: string, title: string): Promise<string | null> => {
      return new Promise((resolve) => {
        if (!socketRef.current) {
          console.warn("Socket not connected");
          resolve(null);
          return;
        }

        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        socketRef.current.emit("start-session", { sessionId, userId, title });

        socketRef.current.once("session-started", (data: { sessionId: string }) => {
          console.log(`Session started: ${data.sessionId}`);
          resolve(data.sessionId);
        });

        setTimeout(() => resolve(null), 5000);
      });
    },
    []
  );

  /**
   * Emit an audio chunk with binary data and metadata
   * Automatically queues chunk if disconnected
   *
   * @param sessionId - Recording session ID
   * @param sequence - Chunk sequence number
   * @param timestamp - Timestamp in ms from recording start
   * @param blob - Audio blob data
   */
  const emitAudioChunk = useCallback(
    async (sessionId: string, sequence: number, timestamp: number, blob: Blob) => {
      if (!socketRef.current?.connected) {
        console.warn(`Socket not connected, queueing chunk ${sequence}`);
        chunkQueueRef.current.push({
          sessionId,
          sequence,
          timestamp,
          blob,
          retryCount: 0,
          queuedAt: Date.now(),
        });
        setQueuedChunks(chunkQueueRef.current.length);
        return;
      }

      try {
        const arrayBuffer = await blob.arrayBuffer();

        socketRef.current.emit("audio-chunk", {
          sessionId,
          sequence,
          timestamp,
          size: blob.size,
          mimeType: blob.type,
          audio: arrayBuffer,
        });

        console.log(`Emitted audio chunk ${sequence} (${blob.size} bytes) at ${timestamp}ms`);
      } catch (error) {
        console.error("Failed to emit audio chunk:", error);

        chunkQueueRef.current.push({
          sessionId,
          sequence,
          timestamp,
          blob,
          retryCount: 0,
          queuedAt: Date.now(),
        });
        setQueuedChunks(chunkQueueRef.current.length);
      }
    },
    []
  );

  /**
   * Pause a recording session
   *
   * @param sessionId - Session ID
   */
  const pauseSession = useCallback((sessionId: string) => {
    if (!socketRef.current) {
      console.warn("Socket not connected");
      return;
    }

    socketRef.current.emit("pause-session", { sessionId, pausedAt: Date.now() });
    console.log(`Pause session requested: ${sessionId}`);
  }, []);

  /**
   * Resume a recording session
   *
   * @param sessionId - Session ID
   */
  const resumeSession = useCallback((sessionId: string) => {
    if (!socketRef.current) {
      console.warn("Socket not connected");
      return;
    }

    socketRef.current.emit("resume-session", { sessionId, resumedAt: Date.now() });
    console.log(`Resume session requested: ${sessionId}`);
  }, []);

  /**
   * Stop a recording session
   *
   * @param sessionId - Session ID
   */
  const stopSession = useCallback((sessionId: string) => {
    if (!socketRef.current) {
      console.warn("Socket not connected");
      return;
    }

    socketRef.current.emit("stop-session", { sessionId });
    console.log(`Stop session requested: ${sessionId}`);
  }, []);

  /**
   * Subscribe to an event
   */
  const on = useCallback((event: string, handler: (...args: any[]) => void) => {
    if (!socketRef.current) return;
    socketRef.current.on(event, handler);
  }, []);

  /**
   * Unsubscribe from an event
   */
  const off = useCallback((event: string, handler?: (...args: any[]) => void) => {
    if (!socketRef.current) return;
    socketRef.current.off(event, handler);
  }, []);

  /**
   * Manually connect the socket
   */
  const connect = useCallback(() => {
    if (socketRef.current && !socketRef.current.connected) {
      socketRef.current.connect();
    }
  }, []);

  /**
   * Manually disconnect the socket
   */
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    error,
    queuedChunks,
    failedChunks,
    emit,
    startSession,
    emitAudioChunk,
    pauseSession,
    resumeSession,
    stopSession,
    on,
    off,
    connect,
    disconnect,
  };
}
