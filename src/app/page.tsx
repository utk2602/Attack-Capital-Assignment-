"use client";

import { useSession, signOut } from "@/lib/authClient";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { RecordingControls } from "@/components/RecordingControls";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useSocket } from "@/hooks/useSocket";
import { FileAudio, History, Wifi, WifiOff } from "lucide-react";

export default function Home() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [chunkCount, setChunkCount] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [bytesTransferred, setBytesTransferred] = useState(0);
  const [avgLatency, setAvgLatency] = useState<number | null>(null);
  const latencySum = useRef(0);
  const latencyCount = useRef(0);

  // Socket.io connection
  const { isConnected, startSession, emitAudioChunk, stopSession, on, off } = useSocket({
    autoConnect: true,
  });

  // Listen for chunk acknowledgments to calculate latency
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
      
      latencySum.current += roundTripLatency;
      latencyCount.current += 1;
      setAvgLatency(Math.round(latencySum.current / latencyCount.current));
      
      console.log(`Chunk ${data.sequence} acknowledged: latency=${roundTripLatency}ms, processing=${data.processingTime}ms`);
    };

    on("chunk-ack", handleChunkAck);
    return () => {
      off("chunk-ack", handleChunkAck);
    };
  }, [on, off]);

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/auth");
    }
  }, [session, isPending, router]);

  const recorder = useAudioRecorder({
    chunkDuration: 30000, // 30 seconds
    onChunk: (chunkData) => {
      console.log(`Received audio chunk ${chunkData.sequence}:`, {
        size: chunkData.blob.size,
        type: chunkData.blob.type,
        timestamp: chunkData.timestamp,
        duration: chunkData.duration,
      });
      setChunkCount(chunkData.sequence + 1);
      setBytesTransferred((prev) => prev + chunkData.blob.size);

      // Emit chunk via Socket.io if connected
      if (isConnected && sessionId) {
        emitAudioChunk(sessionId, chunkData.sequence, chunkData.timestamp, chunkData.blob);
      } else {
        console.warn("Socket not connected or no session ID, chunk not sent");
      }
    },
    onStart: async () => {
      if (!session?.user?.id) {
        console.error("No user session found");
        return;
      }

      // Start a new session via Socket.io
      const newSessionId = await startSession(
        session.user.id,
        `Recording ${new Date().toLocaleString()}`
      );
      
      if (newSessionId) {
        setSessionId(newSessionId);
        setChunkCount(0);
        setBytesTransferred(0);
        latencySum.current = 0;
        latencyCount.current = 0;
        setAvgLatency(null);
        console.log("Recording started with session ID:", newSessionId);
      } else {
        console.error("Failed to start session");
      }
    },
    onStop: () => {
      console.log("Recording stopped");
      if (sessionId) {
        stopSession(sessionId);
      }
      setSessionId(null);
    },
    onError: (error) => {
      console.error("Recording error:", error);
      alert(error.message);
    },
  });

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Navigation */}
      <nav className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <FileAudio className="w-8 h-8 text-brand-500" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">ScribeAI</h1>
          </div>
          <div className="flex items-center gap-4">
            {/* Socket.io Connection Indicator */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-700">
              {isConnected ? (
                <>
                  <Wifi className="w-4 h-4 text-green-500" />
                  <span className="text-xs text-gray-700 dark:text-gray-300">Connected</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 text-red-500" />
                  <span className="text-xs text-gray-700 dark:text-gray-300">Disconnected</span>
                </>
              )}
            </div>
            <button
              onClick={() => router.push("/sessions")}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
            >
              <History className="w-4 h-4" />
              History
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-400">{session.user?.email}</span>
            <button
              onClick={() => signOut()}
              className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 font-medium"
            >
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              AI-Powered Audio Transcription
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              Record audio from your microphone or browser tab and get real-time AI transcription
            </p>
          </div>

          {/* Recording Controls */}
          <div className="mb-8">
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

          {/* Error Display */}
          {recorder.error && (
            <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-red-800 dark:text-red-300 font-medium">Error: {recorder.error}</p>
            </div>
          )}

          {/* Stats */}
          {recorder.isRecording && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="p-6 rounded-lg bg-white dark:bg-gray-800 shadow-md text-center">
                <div className="text-3xl font-bold text-brand-500 mb-2">{chunkCount}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Chunks Recorded</div>
              </div>
              <div className="p-6 rounded-lg bg-white dark:bg-gray-800 shadow-md text-center">
                <div className="text-3xl font-bold text-brand-500 mb-2">
                  {Math.floor(recorder.duration / 60)}:
                  {(recorder.duration % 60).toString().padStart(2, "0")}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Duration</div>
              </div>
              <div className="p-6 rounded-lg bg-white dark:bg-gray-800 shadow-md text-center">
                <div className="text-3xl font-bold text-brand-500 mb-2">
                  {(bytesTransferred / 1024 / 1024).toFixed(2)} MB
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Data Streamed</div>
              </div>
              <div className="p-6 rounded-lg bg-white dark:bg-gray-800 shadow-md text-center">
                <div className="text-3xl font-bold text-brand-500 mb-2">
                  {avgLatency !== null ? `${avgLatency}ms` : "—"}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Avg Latency</div>
              </div>
            </div>
          )}

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-6 mt-12">
            <div className="p-6 rounded-lg bg-white dark:bg-gray-800 shadow-md">
              <div className="w-12 h-12 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center mb-4">
                <FileAudio className="w-6 h-6 text-brand-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Real-Time Recording
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Capture audio from your microphone or any browser tab with low latency
              </p>
            </div>
            <div className="p-6 rounded-lg bg-white dark:bg-gray-800 shadow-md">
              <div className="w-12 h-12 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center mb-4">
                <svg
                  className="w-6 h-6 text-brand-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                AI Transcription
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Powered by Google Gemini for accurate speech-to-text conversion
              </p>
            </div>
            <div className="p-6 rounded-lg bg-white dark:bg-gray-800 shadow-md">
              <div className="w-12 h-12 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center mb-4">
                <History className="w-6 h-6 text-brand-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Session History
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Access all your past recordings with searchable transcripts
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
