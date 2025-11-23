"use client";

import { useEffect, useState } from "react";
import { FileAudio, CheckCircle, Clock, AlertCircle } from "lucide-react";

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

  if (loading) return <div className="p-4 font-bold">Loading history...</div>;

  return (
    <div className="h-full flex flex-col">
      <h3 className="text-xl font-black mb-4 uppercase border-b-4 border-black dark:border-white pb-2">
        Recent Transcripts
      </h3>
      <div className="flex-1 overflow-y-auto space-y-3 pr-2">
        {sessions.length === 0 ? (
          <div className="text-gray-500 italic">No recordings yet.</div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className="p-3 bg-white dark:bg-gray-800 border-4 border-black dark:border-gray-600 shadow-retro hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-retro-hover transition-all cursor-pointer"
            >
              <div className="flex justify-between items-start mb-1">
                <h4 className="font-bold truncate pr-2">{session.title || "Untitled Session"}</h4>
                <span
                  className={`text-xs font-bold px-1 border-2 border-black ${
                    session.status === "completed" ? "bg-green-400" : "bg-yellow-400"
                  }`}
                >
                  {session.status}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                <Clock className="w-3 h-3" />
                <span>{new Date(session.startedAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
