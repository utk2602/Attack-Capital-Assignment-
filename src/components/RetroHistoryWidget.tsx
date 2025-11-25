"use client";

import { useEffect, useState } from "react";
import { FileAudio, CheckCircle, Clock, AlertCircle, ArrowRight } from "lucide-react";
import Link from "next/link";

interface SessionPreview {
  id: string;
  title: string;
  status: string;
  startedAt: string;
  duration: number;
}

export function RetroHistoryWidget() {
  const [sessions, setSessions] = useState<SessionPreview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const response = await fetch("/api/sessions?limit=5");
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions);
      }
    } catch (error) {
      console.error("Failed to fetch sessions", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-4 font-bold animate-pulse">LOADING DATA...</div>;

  return (
    <div className="h-full flex flex-col">
      <h3 className="text-xl font-black mb-6 uppercase border-b-4 border-black dark:border-white pb-2 flex items-center gap-2">
        <span className="w-4 h-4 bg-retro-accent border-2 border-black"></span>
        Recent Transcripts
      </h3>
      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        {sessions.length === 0 ? (
          <div className="text-gray-500 font-bold border-2 border-dashed border-gray-400 p-4 text-center">
            NO RECORDINGS FOUND.
          </div>
        ) : (
          sessions.map((session) => (
            <Link
              key={session.id}
              href={`/sessions/${session.id}`}
              className="block bg-white dark:bg-gray-900 border-4 border-black dark:border-white p-4 shadow-retro hover:shadow-retro-hover hover:translate-x-[2px] hover:translate-y-[2px] transition-all group"
            >
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-bold truncate pr-2 group-hover:text-retro-primary transition-colors">
                  {session.title || "Untitled Session"}
                </h4>
                <StatusIcon status={session.status} />
              </div>
              <div className="flex justify-between items-center text-xs font-bold text-gray-500 dark:text-gray-400">
                <span>{new Date(session.startedAt).toLocaleDateString()}</span>
                <span className="flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  OPEN <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    case "processing":
      return <Clock className="w-5 h-5 text-yellow-500 animate-spin" />;
    case "failed":
      return <AlertCircle className="w-5 h-5 text-red-500" />;
    default:
      return <FileAudio className="w-5 h-5 text-gray-500" />;
  }
}
