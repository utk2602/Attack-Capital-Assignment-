"use client";

import { useEffect, useState } from "react";
import { useSocket } from "@/hooks/useSocket";
import { SessionStatusBadge } from "./SessionStatusBadge";
import { Download, FileText } from "lucide-react";

interface SessionCompletionCardProps {
  sessionId: string;
  onDownload?: (format: "json" | "txt" | "srt" | "vtt") => void;
}

interface SessionSummary {
  executiveSummary: string;
  keyPoints: string[];
  actionItems: Array<{
    speaker: string;
    item: string;
    timestamp?: string;
  }>;
  decisions: Array<{
    decision: string;
    timestamp?: string;
  }>;
  keyTimestamps: Array<{
    time: string;
    event: string;
  }>;
  duration: string;
  participantCount: number;
}

export function SessionCompletionCard({ sessionId, onDownload }: SessionCompletionCardProps) {
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [status, setStatus] = useState<
    "recording" | "paused" | "stopped" | "processing" | "completed"
  >("stopped");
  const { on, off } = useSocket({ autoConnect: true });

  useEffect(() => {
    const handleCompleted = (data: {
      sessionId: string;
      summary: SessionSummary;
      downloadUrl: string;
    }) => {
      if (data.sessionId === sessionId) {
        setSummary(data.summary);
        setStatus("completed");
      }
    };

    on("session-completed", handleCompleted);

    return () => {
      off("session-completed", handleCompleted);
    };
  }, [sessionId, on, off]);

  if (!summary) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex items-center gap-3 mb-4">
          <SessionStatusBadge status={status} size="md" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {status === "processing" ? "Generating Summary..." : "Session Recording Complete"}
          </h3>
        </div>
        {status === "processing" && (
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Transcribing audio and analyzing meeting content...
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SessionStatusBadge status="completed" size="md" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Meeting Summary</h3>
        </div>
        <div className="flex gap-2">
          {(["json", "txt", "srt", "vtt"] as const).map((format) => (
            <button
              key={format}
              onClick={() => onDownload?.(format)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition-colors"
            >
              <Download className="w-3 h-3" />
              {format.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {/* Executive Summary */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Executive Summary
          </h4>
          <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
            {summary.executiveSummary}
          </p>
        </div>

        {/* Key Points */}
        {summary.keyPoints.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Key Points
            </h4>
            <ul className="list-disc list-inside space-y-1">
              {summary.keyPoints.map((point, idx) => (
                <li key={idx} className="text-gray-600 dark:text-gray-400 text-sm">
                  {point}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Action Items */}
        {summary.actionItems.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Action Items
            </h4>
            <div className="space-y-2">
              {summary.actionItems.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 p-2 rounded bg-amber-50 dark:bg-amber-900/20"
                >
                  <div className="flex-1 text-sm">
                    <span className="font-medium text-gray-800 dark:text-gray-200">
                      {item.speaker}:{" "}
                    </span>
                    <span className="text-gray-600 dark:text-gray-400">{item.item}</span>
                  </div>
                  {item.timestamp && (
                    <span className="text-xs text-gray-500 dark:text-gray-500">
                      {item.timestamp}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Decisions */}
        {summary.decisions.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Decisions Made
            </h4>
            <div className="space-y-2">
              {summary.decisions.map((decision, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 p-2 rounded bg-green-50 dark:bg-green-900/20"
                >
                  <span className="flex-1 text-sm text-gray-600 dark:text-gray-400">
                    {decision.decision}
                  </span>
                  {decision.timestamp && (
                    <span className="text-xs text-gray-500 dark:text-gray-500">
                      {decision.timestamp}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Metadata */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center gap-4 text-sm text-gray-500 dark:text-gray-500">
          <span>Duration: {summary.duration}</span>
          <span>•</span>
          <span>Participants: {summary.participantCount}</span>
        </div>
      </div>
    </div>
  );
}
