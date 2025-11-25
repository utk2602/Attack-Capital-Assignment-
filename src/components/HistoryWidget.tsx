"use client";

import { useEffect, useState } from "react";
import { FileAudio, CheckCircle, Clock, AlertCircle, ChevronRight, Calendar } from "lucide-react";
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
      const response = await fetch("/api/sessions?limit=10");
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-secondary-900 rounded-2xl shadow-sm border border-secondary-200 dark:border-secondary-800 overflow-hidden">
      <div className="p-6 border-b border-secondary-200 dark:border-secondary-800 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Recent Sessions</h3>
        <span className="text-xs font-medium text-secondary-500 bg-secondary-100 dark:bg-secondary-800 px-2 py-1 rounded-full">
          {sessions.length} Total
        </span>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-secondary-400">
            <FileAudio className="w-12 h-12 mb-4 opacity-20" />
            <p className="font-medium">No recordings found</p>
            <p className="text-sm">Start a new session to see it here</p>
          </div>
        ) : (
          <div className="divide-y divide-secondary-100 dark:divide-secondary-800">
            {sessions.map((session) => (
              <Link
                key={session.id}
                href={`/sessions/${session.id}`}
                className="group flex items-center justify-between p-4 hover:bg-secondary-50 dark:hover:bg-secondary-800/50 transition-colors"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    session.status === "completed" 
                      ? "bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400"
                      : "bg-amber-100 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400"
                  }`}>
                    {session.status === "completed" ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <Clock className="w-5 h-5" />
                    )}
                  </div>
                  
                  <div className="min-w-0">
                    <h4 className="font-medium text-foreground truncate group-hover:text-primary-600 transition-colors">
                      {session.title || "Untitled Session"}
                    </h4>
                    <div className="flex items-center gap-3 text-xs text-secondary-500 mt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(session.startedAt).toLocaleDateString()}
                      </span>
                      <span className="w-1 h-1 rounded-full bg-secondary-300" />
                      <span>
                        {new Date(session.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 pl-4">
                  <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full capitalize ${
                    session.status === "completed"
                      ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                      : "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
                  }`}>
                    {session.status}
                  </span>
                  <ChevronRight className="w-4 h-4 text-secondary-400 group-hover:text-primary-500 transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
