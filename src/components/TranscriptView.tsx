"use client";

import { useEffect, useRef, useState } from "react";
import { useSocket } from "@/hooks/useSocket";

interface TranscriptSegment {
  sequence: number;
  text: string;
  speaker?: string;
  timestamp: number;
  chunkId: string;
}

interface TranscriptViewProps {
  sessionId: string | null;
}

export function TranscriptView({ sessionId }: TranscriptViewProps) {
  const { socket, isConnected } = useSocket({
    autoConnect: false, // Don't auto-connect, we'll manage socket lifecycle manually
  });
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const hasJoinedRoom = useRef(false);

  useEffect(() => {
    if (!socket || !sessionId) return;
    if (!isConnected) {
      console.warn("[TranscriptView] Socket not connected yet, waiting...");
      return;
    }
    if (hasJoinedRoom.current) return;

    console.log(`[TranscriptView] Joining session room: ${sessionId}`);
    hasJoinedRoom.current = true;
    socket.emit("join", `session:${sessionId}`);

    const handleTranscriptUpdate = (data: TranscriptSegment) => {
      console.log(`[TranscriptView] Received transcript update:`, data);
      setSegments((prev) => {
        const existing = prev.findIndex((s) => s.sequence === data.sequence);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = data;
          return updated;
        }
        return [...prev, data].sort((a, b) => a.sequence - b.sequence);
      });
    };

    socket.on("transcript-updated", handleTranscriptUpdate);

    return () => {
      console.log(`[TranscriptView] Leaving session room: ${sessionId}`);
      socket.off("transcript-updated", handleTranscriptUpdate);
      if (isConnected) {
        socket.emit("leave", `session:${sessionId}`);
      }
      hasJoinedRoom.current = false;
    };
  }, [socket, sessionId, isConnected]); // Add isConnected to dependencies

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [segments, autoScroll]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setAutoScroll(isNearBottom);
  };

  if (!sessionId || segments.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
        <p>Transcript will appear here as audio is transcribed...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white">Live Transcript</h3>
        <button
          onClick={() => setAutoScroll(!autoScroll)}
          className={`px-3 py-1 text-sm rounded ${
            autoScroll
              ? "bg-brand-500 text-white"
              : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
          }`}
        >
          {autoScroll ? "Auto-scroll On" : "Auto-scroll Off"}
        </button>
      </div>

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {segments.map((segment) => (
          <div
            key={segment.chunkId}
            className="p-4 rounded-lg bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 animate-fade-in"
          >
            <div className="flex items-center gap-2 mb-2">
              {segment.speaker && (
                <span className="px-2 py-1 text-xs font-medium rounded bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-300">
                  {segment.speaker}
                </span>
              )}
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {new Date(segment.timestamp).toLocaleTimeString()}
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500">#{segment.sequence}</span>
            </div>
            <p className="text-gray-900 dark:text-gray-100 leading-relaxed">{segment.text}</p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
