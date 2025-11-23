"use client";

import { useSession } from "@/lib/authClient";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { RecordingControls } from "@/components/RecordingControls";
import { AudioPlayer } from "@/components/AudioPlayer";
import { TranscriptView } from "@/components/TranscriptView";
import { SessionCompletionCard } from "@/components/SessionCompletionCard";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useSocket } from "@/hooks/useSocket";
import { Wifi, WifiOff } from "lucide-react";
import { RetroLanding } from "@/components/RetroLanding";
import { RetroSidebar } from "@/components/RetroSidebar";
import { RetroHistoryWidget } from "@/components/RetroHistoryWidget";
import AudioUpload from "@/components/AudioUpload";

export default function Home() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"home" | "history" | "upload">("home");

  // Logic State
  const [chunkCount, setChunkCount] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [completedSessionId, setCompletedSessionId] = useState<string | null>(null);
  const [bytesTransferred, setBytesTransferred] = useState(0);
  const [avgLatency, setAvgLatency] = useState<number | null>(null);
  const [lastLatency, setLastLatency] = useState<number | null>(null);
  const latencySum = useRef(0);
  const latencyCount = useRef(0);
  const activeSessionIdRef = useRef<string | null>(null);

  // Socket connection
  const {
    isConnected,
    queuedChunks,
    failedChunks,
    startSession,
    emitAudioChunk,
    pauseSession,
    resumeSession,
    stopSession,
    on,
    off,
  } = useSocket({
    autoConnect: !!session?.user,
  });

  // Latency tracking
  useEffect(() => {
    const handleChunkAck = (data: {
      sessionId: string;
      sequence: number;
      timestamp: number;
      receivedAt: number;
      processingTime: number;
      bytesReceived: number;
    }) => {
      const now = Date.now();
      const roundTripLatency = now - data.timestamp;

      setLastLatency(roundTripLatency);
      latencySum.current += roundTripLatency;
      latencyCount.current += 1;
      setAvgLatency(Math.round(latencySum.current / latencyCount.current));
    };

    on("chunk-ack", handleChunkAck);
    return () => {
      off("chunk-ack", handleChunkAck);
    };
  }, [on, off]);

  const recorder = useAudioRecorder({
    chunkDuration: 30000, // 30 seconds for better efficiency
    onChunk: (chunkData) => {
      setChunkCount(chunkData.sequence + 1);
      setBytesTransferred((prev) => prev + chunkData.blob.size);

      const currentSessionId = activeSessionIdRef.current;
      if (currentSessionId) {
        emitAudioChunk(currentSessionId, chunkData.sequence, chunkData.timestamp, chunkData.blob);
      }
    },
    onStart: async () => {
      if (!session?.user?.id) return;

      const newSessionId = await startSession(
        session.user.id,
        `Recording ${new Date().toLocaleString()}`
      );

      if (newSessionId) {
        setSessionId(newSessionId);
        activeSessionIdRef.current = newSessionId;
        setChunkCount(0);
        setBytesTransferred(0);
        latencySum.current = 0;
        latencyCount.current = 0;
        setAvgLatency(null);
        setLastLatency(null);
      } else {
        alert("Failed to start session.");
      }
    },
    onPause: () => {
      if (sessionId) pauseSession(sessionId);
    },
    onResume: () => {
      if (sessionId) resumeSession(sessionId);
    },
    onStop: () => {
      if (sessionId) {
        stopSession(sessionId);
        setCompletedSessionId(sessionId);
        setTimeout(() => {
          activeSessionIdRef.current = null;
        }, 2000);
      }
      setSessionId(null);
    },
    onError: (error) => {
      alert(error.message);
    },
  });

  if (isPending) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-retro-bg">
        <div className="text-2xl font-black animate-pulse">LOADING...</div>
      </div>
    );
  }

  if (!session) {
    return <RetroLanding />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-retro-bg dark:bg-retro-dark text-black dark:text-white font-mono">
      {/* Sidebar */}
      <RetroSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        userEmail={session.user?.email}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Header */}
        <header className="h-16 border-b-4 border-black dark:border-white bg-white dark:bg-black flex items-center justify-between px-6 shrink-0 z-10">
          <h2 className="text-2xl font-black uppercase tracking-tighter">
            {activeTab === "home"
              ? "Studio Dashboard"
              : activeTab === "upload"
                ? "Upload Audio"
                : "Session Archives"}
          </h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1 border-2 border-black dark:border-white bg-gray-100 dark:bg-gray-800 shadow-retro-hover">
              {isConnected ? (
                <>
                  <Wifi className="w-4 h-4 text-green-600" />
                  <span className="text-xs font-bold">ONLINE</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 text-red-600" />
                  <span className="text-xs font-bold">OFFLINE</span>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "home" ? (
            <div className="max-w-6xl mx-auto space-y-8 pb-20">
              {/* Recording Section */}
              <div className="bg-white dark:bg-gray-900 border-4 border-black dark:border-white p-6 shadow-retro relative">
                <div className="absolute -top-4 -left-4 bg-retro-primary border-4 border-black px-4 py-1 font-black transform -rotate-2 shadow-retro-hover">
                  CONTROLS
                </div>
                <div className="mt-4">
                  <RecordingControls
                    status={recorder.status}
                    audioSource={recorder.audioSource}
                    duration={recorder.duration}
                    onStart={recorder.start}
                    onPause={recorder.pause}
                    onResume={recorder.resume}
                    onStop={recorder.stop}
                    onSourceChange={recorder.changeSource}
                  />
                </div>
                {recorder.error && (
                  <div className="mt-4 p-4 bg-red-100 border-4 border-red-500 text-red-900 font-bold">
                    ERROR: {recorder.error}
                  </div>
                )}
              </div>

              {/* Live Transcript */}
              {sessionId && (
                <div className="bg-white dark:bg-gray-900 border-4 border-black dark:border-white p-6 shadow-retro relative">
                  <div className="absolute -top-4 -right-4 bg-retro-accent border-4 border-black px-4 py-1 font-black transform rotate-2 shadow-retro-hover flex items-center gap-2">
                    <span className="animate-pulse w-3 h-3 bg-red-500 rounded-full border border-black"></span>
                    LIVE FEED
                  </div>
                  <div className="mt-4 h-[400px] overflow-hidden border-2 border-black dark:border-gray-700 bg-gray-50 dark:bg-black">
                    <TranscriptView sessionId={sessionId} />
                  </div>
                </div>
              )}

              {/* Stats Grid */}
              {recorder.isRecording && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: "CHUNKS", value: chunkCount, color: "bg-retro-secondary" },
                    {
                      label: "DURATION",
                      value: `${Math.floor(recorder.duration / 60)}:${(recorder.duration % 60)
                        .toString()
                        .padStart(2, "0")}`,
                      color: "bg-retro-primary",
                    },
                    {
                      label: "DATA",
                      value: `${(bytesTransferred / 1024 / 1024).toFixed(2)} MB`,
                      color: "bg-retro-accent",
                    },
                    {
                      label: "LATENCY",
                      value: avgLatency !== null ? `${avgLatency}ms` : "—",
                      color: "bg-white dark:bg-gray-800",
                    },
                  ].map((stat, i) => (
                    <div
                      key={i}
                      className={`${stat.color} border-4 border-black p-4 shadow-retro text-center`}
                    >
                      <div className="text-2xl font-black">{stat.value}</div>
                      <div className="text-xs font-bold uppercase tracking-widest">
                        {stat.label}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Completed Session View */}
              {completedSessionId && !sessionId && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-retro-secondary border-4 border-black p-6 shadow-retro">
                    <h3 className="text-xl font-black mb-4 uppercase">Session Complete</h3>
                    <AudioPlayer sessionId={completedSessionId} />
                  </div>

                  <div className="bg-white dark:bg-gray-900 border-4 border-black dark:border-white p-6 shadow-retro">
                    <SessionCompletionCard
                      sessionId={completedSessionId}
                      onDownload={(format) => {
                        window.open(
                          `/api/sessions/${completedSessionId}/download?format=${format}`,
                          "_blank"
                        );
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : activeTab === "upload" ? (
            <div className="max-w-4xl mx-auto h-full">
              <AudioUpload />
            </div>
          ) : (
            <div className="max-w-4xl mx-auto h-full">
              <RetroHistoryWidget />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
