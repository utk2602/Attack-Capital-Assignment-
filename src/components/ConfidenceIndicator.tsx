"use client";

import React, { useState } from "react";
import { AlertTriangle, Check, Flag } from "lucide-react";
import { clsx } from "clsx";

interface TranscriptChunk {
  id: string;
  seq: number;
  text: string;
  speaker?: string;
  confidence?: number;
  timestamp?: number;
  flagged?: boolean;
}

interface Props {
  chunks: TranscriptChunk[];
  onFlagChunk?: (chunkId: string) => void;
}

export default function ConfidenceIndicator({ chunks, onFlagChunk }: Props) {
  const [flaggedChunks, setFlaggedChunks] = useState<Set<string>>(new Set());

  const getConfidenceLevel = (confidence?: number) => {
    if (!confidence) return "unknown";
    if (confidence >= 0.9) return "high";
    if (confidence >= 0.7) return "medium";
    return "low";
  };

  const getConfidenceColor = (level: string) => {
    switch (level) {
      case "high":
        return "text-green-600 dark:text-green-400";
      case "medium":
        return "text-yellow-600 dark:text-yellow-400";
      case "low":
        return "text-red-600 dark:text-red-400";
      default:
        return "text-gray-400 dark:text-gray-500";
    }
  };

  const getConfidenceBg = (level: string) => {
    switch (level) {
      case "high":
        return "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800";
      case "medium":
        return "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800";
      case "low":
        return "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800";
      default:
        return "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700";
    }
  };

  const handleFlagChunk = (chunkId: string) => {
    const newFlagged = new Set(flaggedChunks);
    if (newFlagged.has(chunkId)) {
      newFlagged.delete(chunkId);
    } else {
      newFlagged.add(chunkId);
    }
    setFlaggedChunks(newFlagged);

    if (onFlagChunk) {
      onFlagChunk(chunkId);
    }
  };

  const lowConfidenceChunks = chunks.filter((c) => c.confidence && c.confidence < 0.7);

  return (
    <div className="space-y-4">
      {/* Summary Banner */}
      {lowConfidenceChunks.length > 0 && (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-yellow-900 dark:text-yellow-200">
                Low Confidence Detected
              </h3>
              <p className="text-sm text-yellow-800 dark:text-yellow-300 mt-1">
                {lowConfidenceChunks.length} segment{lowConfidenceChunks.length !== 1 ? "s" : ""}{" "}
                may need manual review. These segments have confidence below 70%.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {chunks.map((chunk) => {
          const level = getConfidenceLevel(chunk.confidence);
          const isFlagged = flaggedChunks.has(chunk.id);
          const showWarning = level === "low" || level === "medium";

          return (
            <div
              key={chunk.id}
              className={clsx(
                "p-4 rounded-lg border transition-all",
                getConfidenceBg(level),
                isFlagged && "ring-2 ring-blue-500"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {/* Header */}
                  <div className="flex items-center gap-2 mb-2">
                    {chunk.speaker && (
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                        {chunk.speaker}
                      </span>
                    )}
                    <span className="text-xs text-gray-500 dark:text-gray-400">#{chunk.seq}</span>
                    {chunk.confidence !== undefined && (
                      <div className="flex items-center gap-1">
                        {level === "high" && (
                          <Check className={clsx("w-4 h-4", getConfidenceColor(level))} />
                        )}
                        {showWarning && (
                          <AlertTriangle className={clsx("w-4 h-4", getConfidenceColor(level))} />
                        )}
                        <span className={clsx("text-xs font-medium", getConfidenceColor(level))}>
                          {(chunk.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Text */}
                  <p className="text-sm text-gray-900 dark:text-gray-100 leading-relaxed">
                    {chunk.text}
                  </p>

                  {/* Warning Message */}
                  {showWarning && (
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 italic">
                      {level === "low"
                        ? "⚠️ Likely inaccurate - manual review recommended"
                        : "⚠️ Moderate confidence - may need verification"}
                    </p>
                  )}
                </div>

                {/* Flag Button */}
                <button
                  onClick={() => handleFlagChunk(chunk.id)}
                  className={clsx(
                    "p-2 rounded-md transition-all flex-shrink-0",
                    isFlagged
                      ? "bg-blue-500 text-white hover:bg-blue-600"
                      : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600"
                  )}
                  title={isFlagged ? "Unflag for review" : "Flag for manual review"}
                >
                  <Flag className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Flagged Summary */}
      {flaggedChunks.size > 0 && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flag className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-blue-900 dark:text-blue-200">
                {flaggedChunks.size} segment{flaggedChunks.size !== 1 ? "s" : ""} flagged for review
              </span>
            </div>
            <button
              onClick={() => setFlaggedChunks(new Set())}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Clear all flags
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
