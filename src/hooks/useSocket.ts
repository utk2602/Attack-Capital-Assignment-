"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

interface UseSocketOptions {
  /**
   * Socket.io server URL
   * @default "http://localhost:3000"
   */
  url?: string;

  /**
   * Authentication token (optional)
   */
  token?: string;

  /**
   * Auto-connect on mount
   * @default true
   */
  autoConnect?: boolean;
}

export function useSocket(options: UseSocketOptions = {}) {
  const {
    url = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3000",
    token,
    autoConnect = true,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!autoConnect) return;

    // Create socket connection
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

    // Cleanup on unmount
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [url, token, autoConnect]);

  /**
   * Emit a regular event with JSON data
   */
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

        // Wait for acknowledgment
        socketRef.current.once("session-started", (data: { sessionId: string }) => {
          console.log(`Session started: ${data.sessionId}`);
          resolve(data.sessionId);
        });

        // Timeout after 5 seconds
        setTimeout(() => resolve(null), 5000);
      });
    },
    []
  );

  /**
   * Emit an audio chunk with binary data and metadata
   * 
   * @param sessionId - Recording session ID
   * @param sequence - Chunk sequence number
   * @param timestamp - Timestamp in ms from recording start
   * @param blob - Audio blob data
   */
  const emitAudioChunk = useCallback(
    async (sessionId: string, sequence: number, timestamp: number, blob: Blob) => {
      if (!socketRef.current) {
        console.warn("Socket not connected");
        return;
      }

      try {
        // Convert Blob to ArrayBuffer for binary transmission
        const arrayBuffer = await blob.arrayBuffer();

        // Emit with metadata and binary data
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
      }
    },
    []
  );

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
    emit,
    startSession,
    emitAudioChunk,
    stopSession,
    on,
    off,
    connect,
    disconnect,
  };
}
