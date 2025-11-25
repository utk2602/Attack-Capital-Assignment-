"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, Clock, Calendar, Mic2, Loader2 } from "lucide-react";
import Link from "next/link";

interface SessionDetail {
  id: string;
  title: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  duration: number;
  chunkCount: number;
  transcript: string | null;
  summaryJSON: any;
  source?: string;
}

export default function SessionDetailPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchSession();

    // Poll for updates if still processing
    const interval = setInterval(() => {
      if (session?.status === "processing") {
        fetchSession();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [sessionId, session?.status]);

  const fetchSession = async () => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch session");
      }
      const data = await response.json();
      setSession(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const downloadTranscript = (format: "txt" | "json" | "srt") => {
    window.open(`/api/sessions/${sessionId}/download?format=${format}`, "_blank");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-retro-bg dark:bg-retro-dark">
        <Loader2 className="w-12 h-12 animate-spin" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-retro-bg dark:bg-retro-dark p-4">
        <div className="bg-red-100 border-4 border-red-500 p-6 max-w-md text-center">
          <h2 className="text-xl font-black mb-2">ERROR</h2>
          <p className="font-bold">{error || "Session not found"}</p>
          <Link
            href="/history"
            className="mt-4 inline-block px-6 py-2 bg-black text-white font-bold border-4 border-black shadow-retro"
          >
            Back to History
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-retro-bg dark:bg-retro-dark p-6 font-mono">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          <Link
            href="/history"
            className="p-3 bg-white dark:bg-gray-900 border-4 border-black dark:border-white shadow-retro hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-retro-hover transition-all"
          >
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-3xl font-black uppercase tracking-tighter">{session.title}</h1>
        </div>

        {/* Status Card */}
        <div className="mb-6 p-6 bg-white dark:bg-gray-900 border-4 border-black dark:border-white shadow-retro">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-black uppercase">Session Info</h2>
            <span
              className={`px-4 py-1 font-bold border-2 border-black uppercase ${
                session.status === "completed"
                  ? "bg-green-400"
                  : session.status === "processing"
                    ? "bg-yellow-400"
                    : "bg-orange-400"
              }`}
            >
              {session.status}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 border-2 border-black dark:border-white bg-gray-50 dark:bg-black">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-xs font-bold uppercase">Duration</span>
              </div>
              <div className="text-2xl font-black">{formatDuration(session.duration)}</div>
            </div>

            <div className="p-3 border-2 border-black dark:border-white bg-gray-50 dark:bg-black">
              <div className="flex items-center gap-2 mb-1">
                <Mic2 className="w-4 h-4" />
                <span className="text-xs font-bold uppercase">Source</span>
              </div>
              <div className="text-2xl font-black">{(session.source || "MIC").toUpperCase()}</div>
            </div>

            <div className="p-3 border-2 border-black dark:border-white bg-gray-50 dark:bg-black">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4" />
                <span className="text-xs font-bold uppercase">Chunks</span>
              </div>
              <div className="text-2xl font-black">{session.chunkCount}</div>
            </div>

            <div className="p-3 border-2 border-black dark:border-white bg-gray-50 dark:bg-black">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4" />
                <span className="text-xs font-bold uppercase">Started</span>
              </div>
              <div className="text-sm font-bold">{formatDate(session.startedAt)}</div>
            </div>
          </div>
        </div>

        {/* Processing Message */}
        {session.status === "processing" && (
          <div className="mb-6 p-4 bg-yellow-100 border-4 border-yellow-500 flex items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin" />
            <div className="font-bold">PROCESSING TRANSCRIPT... This may take a few moments.</div>
          </div>
        )}

        {/* Download Buttons */}
        {session.status === "completed" && session.transcript && (
          <div className="mb-6 p-4 bg-retro-accent border-4 border-black shadow-retro">
            <h3 className="text-lg font-black mb-3 uppercase">Export Options</h3>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => downloadTranscript("txt")}
                className="px-4 py-2 bg-white border-4 border-black font-bold shadow-retro hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-retro-hover transition-all flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                TXT
              </button>
              <button
                onClick={() => downloadTranscript("json")}
                className="px-4 py-2 bg-white border-4 border-black font-bold shadow-retro hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-retro-hover transition-all flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                JSON
              </button>
              <button
                onClick={() => downloadTranscript("srt")}
                className="px-4 py-2 bg-white border-4 border-black font-bold shadow-retro hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-retro-hover transition-all flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                SRT
              </button>
            </div>
          </div>
        )}

        {/* Transcript Section */}
        {session.transcript && (
          <div className="mb-6 p-6 bg-white dark:bg-gray-900 border-4 border-black dark:border-white shadow-retro">
            <div className="flex items-center justify-between mb-4 border-b-4 border-black dark:border-white pb-2">
              <h3 className="text-xl font-black uppercase">📝 Transcript</h3>
              <span className="px-3 py-1 bg-retro-accent border-2 border-black text-xs font-bold">
                {session.transcript.split(" ").filter((w) => w.length > 0).length} WORDS
              </span>
            </div>
            <div className="prose dark:prose-invert max-w-none">
              <p className="text-base leading-relaxed whitespace-pre-wrap">
                {session.transcript}
              </p>
            </div>
          </div>
        )}

        {/* Summary Section */}
        {session.summaryJSON && session.summaryJSON.executiveSummary && (
          <div className="mb-6 p-6 bg-white dark:bg-gray-900 border-4 border-black dark:border-white shadow-retro">
            <div className="flex items-center justify-between mb-4 border-b-4 border-black dark:border-white pb-2">
              <h3 className="text-xl font-black uppercase">📊 Summary</h3>
              <span className="px-3 py-1 bg-retro-accent border-2 border-black text-xs font-bold">
                AI GENERATED
              </span>
            </div>
            <div className="prose dark:prose-invert max-w-none">
              <p className="text-base leading-relaxed whitespace-pre-wrap">
                {session.summaryJSON.executiveSummary}
              </p>
            </div>
          </div>
        )}

        {/* No Transcript Message */}
        {!session.transcript && session.status === "completed" && (
          <div className="p-6 bg-gray-100 dark:bg-gray-800 border-4 border-gray-400 text-center">
            <p className="font-bold">No transcript available for this session.</p>
          </div>
        )}
      </div>
    </div>
  );
}
