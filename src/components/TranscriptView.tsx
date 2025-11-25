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
      <div className="flex flex-col items-center justify-center h-full p-6 space-y-4">
        <div className="text-center space-y-3 max-w-md">
          {sessionId ? (
            <>
              <div className="text-6xl mb-4">🎙️</div>
              <h3 className="text-xl font-black uppercase">Processing Audio...</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-center gap-2 p-3 bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-500">
                  <span className="animate-pulse">🔵</span>
                  <span className="font-bold">Audio chunks being captured</span>
                </div>
                <div className="flex items-center justify-center gap-2 p-3 bg-yellow-100 dark:bg-yellow-900/30 border-2 border-yellow-500">
                  <span className="animate-pulse">⚡</span>
                  <span className="font-bold">Gemini AI processing in background</span>
                </div>
                <div className="p-3 bg-gray-100 dark:bg-gray-800 border-2 border-gray-400">
                  <p className="text-xs">
                    <strong>Note:</strong> Real-time transcript will appear once first chunk is
                    processed (~10 seconds)
                  </p>
                </div>
              </div>

              {/* System Audio Warning */}
              <div className="mt-4 p-4 bg-orange-100 dark:bg-orange-900/30 border-2 border-orange-500 text-left">
                <p className="text-xs font-bold mb-2">⚠️ Recording Meeting Audio?</p>
                <ul className="text-xs space-y-1 list-disc list-inside">
                  <li>
                    <strong>Mic Source:</strong> Only captures your microphone, not meeting audio
                  </li>
                  <li>
                    <strong>Browser Tab Source:</strong> Captures tab audio (works for web meetings)
                  </li>
                  <li>
                    <strong>System Audio:</strong> Not supported directly by browser
                  </li>
                </ul>
                <p className="text-xs mt-2 font-bold">
                  💡 Switch to "Browser Tab" source before joining meeting!
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="text-6xl mb-4">📝</div>
              <p className="text-gray-500 dark:text-gray-400 font-bold">
                Start recording to see real-time processing status
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Processing Status Header */}
      <div className="flex items-center justify-between p-4 border-b-4 border-black dark:border-white bg-retro-accent">
        <div className="flex items-center gap-3">
          <span className="animate-pulse text-2xl">🔴</span>
          <div>
            <h3 className="font-black uppercase text-sm">Real-Time Processing</h3>
            <p className="text-xs font-bold">{segments.length} chunks processed</p>
          </div>
        </div>
        <button
          onClick={() => setAutoScroll(!autoScroll)}
          className={`px-3 py-2 text-xs font-bold border-2 border-black uppercase transition-all ${
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
        className="flex-1 overflow-y-auto p-4 space-y-3 bg-retro-bg dark:bg-retro-dark"
      >
        {/* Metadata Cards - Not actual transcript, just processing indicators */}
        {segments.map((segment) => (
          <div
            key={segment.chunkId}
            className="p-4 bg-white dark:bg-gray-900 border-4 border-black dark:border-white shadow-retro"
          >
            {/* Processing Metadata */}
            <div className="flex items-center justify-between mb-3 pb-2 border-b-2 border-gray-300 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <span className="text-xl">📊</span>
                <span className="text-xs font-bold uppercase text-retro-primary">
                  Chunk #{segment.sequence}
                </span>
              </div>
              <div className="flex gap-2 text-xs">
                {segment.speaker && (
                  <span className="px-2 py-1 bg-retro-secondary border-2 border-black font-bold">
                    👤 {segment.speaker}
                  </span>
                )}
                <span className="px-2 py-1 bg-gray-200 dark:bg-gray-800 border-2 border-black font-bold">
                  ⏱️ {new Date(segment.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>

            {/* Processing Status - Not the actual words */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-green-500 font-bold">✓</span>
                <span className="font-bold">Audio captured: ~10 seconds</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-green-500 font-bold">✓</span>
                <span className="font-bold">
                  Gemini processing: {segment.text.length} characters extracted
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-blue-500 font-bold">⚡</span>
                <span className="font-bold">Content being analyzed for final transcript</span>
              </div>

              {/* Preview snippet */}
              <div className="mt-3 p-2 bg-gray-100 dark:bg-black border-l-4 border-retro-primary">
                <p className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
                  Raw Content Preview:
                </p>
                <p className="text-xs italic line-clamp-2">{segment.text.substring(0, 100)}...</p>
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
