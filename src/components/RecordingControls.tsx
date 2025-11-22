"use client";

import { Play, Pause, Square, Mic, Monitor } from "lucide-react";
import { clsx } from "clsx";

export type RecordingStatus = "idle" | "recording" | "paused" | "processing";
export type AudioSource = "mic" | "tab";

interface RecordingControlsProps {
  status: RecordingStatus;
  audioSource: AudioSource;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onSourceChange: (source: AudioSource) => void;
  duration?: number;
}

export function RecordingControls({
  status,
  audioSource,
  onStart,
  onPause,
  onResume,
  onStop,
  onSourceChange,
  duration = 0,
}: RecordingControlsProps) {
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Status Indicator */}
      <div className="flex items-center justify-center gap-3 p-4 rounded-lg bg-white dark:bg-gray-800 shadow-md">
        <div
          className={clsx("w-3 h-3 rounded-full animate-pulse", {
            "bg-gray-400": status === "idle",
            "bg-red-500": status === "recording",
            "bg-yellow-500": status === "paused",
            "bg-blue-500": status === "processing",
          })}
        />
        <span className="text-lg font-medium text-gray-900 dark:text-white capitalize">
          {status === "idle" ? "Ready to Record" : status}
        </span>
        {status !== "idle" && (
          <span className="ml-auto text-2xl font-mono text-gray-600 dark:text-gray-400">
            {formatDuration(duration)}
          </span>
        )}
      </div>

      {/* Audio Source Toggle */}
      <div className="flex items-center justify-center gap-2 p-2 rounded-lg bg-white dark:bg-gray-800 shadow-md">
        <button
          onClick={() => onSourceChange("mic")}
          disabled={status === "recording" || status === "processing"}
          className={clsx(
            "flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            audioSource === "mic"
              ? "bg-brand-500 text-white shadow-lg"
              : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
          )}
        >
          <Mic className="w-5 h-5" />
          Microphone
        </button>
        <button
          onClick={() => onSourceChange("tab")}
          disabled={status === "recording" || status === "processing"}
          className={clsx(
            "flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            audioSource === "tab"
              ? "bg-brand-500 text-white shadow-lg"
              : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
          )}
        >
          <Monitor className="w-5 h-5" />
          Browser Tab
        </button>
      </div>

      {/* Control Buttons */}
      <div className="flex items-center justify-center gap-4">
        {status === "idle" && (
          <button
            onClick={onStart}
            className="flex items-center gap-3 px-8 py-4 rounded-full bg-red-500 hover:bg-red-600 text-white font-semibold text-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
          >
            <Play className="w-6 h-6 fill-current" />
            Start Recording
          </button>
        )}

        {status === "recording" && (
          <>
            <button
              onClick={onPause}
              className="flex items-center gap-3 px-8 py-4 rounded-full bg-yellow-500 hover:bg-yellow-600 text-white font-semibold text-lg shadow-lg hover:shadow-xl transition-all"
            >
              <Pause className="w-6 h-6" />
              Pause
            </button>
            <button
              onClick={onStop}
              className="flex items-center gap-3 px-8 py-4 rounded-full bg-gray-700 hover:bg-gray-800 text-white font-semibold text-lg shadow-lg hover:shadow-xl transition-all"
            >
              <Square className="w-6 h-6" />
              Stop
            </button>
          </>
        )}

        {status === "paused" && (
          <>
            <button
              onClick={onResume}
              className="flex items-center gap-3 px-8 py-4 rounded-full bg-green-500 hover:bg-green-600 text-white font-semibold text-lg shadow-lg hover:shadow-xl transition-all"
            >
              <Play className="w-6 h-6 fill-current" />
              Resume
            </button>
            <button
              onClick={onStop}
              className="flex items-center gap-3 px-8 py-4 rounded-full bg-gray-700 hover:bg-gray-800 text-white font-semibold text-lg shadow-lg hover:shadow-xl transition-all"
            >
              <Square className="w-6 h-6" />
              Stop
            </button>
          </>
        )}

        {status === "processing" && (
          <div className="flex items-center gap-3 px-8 py-4 rounded-full bg-blue-500 text-white font-semibold text-lg shadow-lg">
            <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin" />
            Processing...
          </div>
        )}
      </div>

      {/* Help Text */}
      <div className="text-center text-sm text-gray-600 dark:text-gray-400">
        {status === "idle" && audioSource === "mic" && (
          <p>Click "Start Recording" to capture audio from your microphone</p>
        )}
        {status === "idle" && audioSource === "tab" && (
          <p>Click "Start Recording" and select a browser tab to capture its audio</p>
        )}
        {status === "recording" && (
          <p>Recording in progress... Click "Pause" to temporarily stop or "Stop" to finish</p>
        )}
        {status === "paused" && (
          <p>Recording paused. Click "Resume" to continue or "Stop" to finish</p>
        )}
        {status === "processing" && <p>Processing your recording... Please wait</p>}
      </div>
    </div>
  );
}
