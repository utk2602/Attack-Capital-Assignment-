"use client";

import React, { useEffect } from "react";
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

  // enable keyboard shortcuts
  useRecordingKeyboardShortcuts(status, onStart, onPause, onResume, onStop);
  return (
    <div className="w-full space-y-4">
      {/* Status Indicator */}
      <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-900 border-4 border-black dark:border-white shadow-retro">
        <div className="flex items-center gap-3">
          <div
            className={clsx("w-4 h-4 border-2 border-black", {
              "bg-gray-400": status === "idle",
              "bg-red-500 animate-pulse": status === "recording",
              "bg-yellow-500": status === "paused",
              "bg-blue-500 animate-pulse": status === "processing",
            })}
          />
          <div>
            <span className="text-lg font-black uppercase tracking-tight block">
              {status === "idle" ? "Ready" : status}
            </span>
            {status === "recording" && (
              <span className="text-xs font-bold text-gray-600 dark:text-gray-400">
                {audioSource === "mic" ? "🎤 Microphone Active" : "🌐 Browser Tab Audio"}
              </span>
            )}
          </div>
        </div>
        {status !== "idle" && (
          <span className="text-2xl font-black font-mono">{formatDuration(duration)}</span>
        )}
      </div>

      {/* Audio Source Toggle */}
      <div className="flex gap-3">
        <button
          onClick={() => onSourceChange("mic")}
          disabled={status === "recording" || status === "processing"}
          aria-label="Select microphone as audio source (disabled while recording)"
          className={clsx(
            "flex-1 flex items-center justify-center gap-2 px-6 py-4 font-bold border-4 border-black transition-all uppercase",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            audioSource === "mic"
              ? "bg-retro-primary text-black shadow-retro"
              : "bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
          )}
        >
          <Mic className="w-5 h-5" />
          Mic
        </button>
        <button
          onClick={() => onSourceChange("tab")}
          disabled={status === "recording" || status === "processing"}
          aria-label="Select browser tab as audio source (disabled while recording)"
          className={clsx(
            "flex-1 flex items-center justify-center gap-2 px-6 py-4 font-bold border-4 border-black transition-all uppercase",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            audioSource === "tab"
              ? "bg-retro-secondary text-black shadow-retro"
              : "bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
          )}
        >
          <Monitor className="w-5 h-5" />
          Browser
        </button>
      </div>
      <div
        className="flex items-center justify-center gap-4"
        role="group"
        aria-label="Recording controls"
      >
        {status === "idle" && (
          <button
            onClick={onStart}
            aria-keyshortcuts="r"
            aria-label="Start recording (R)"
            className="flex items-center gap-3 px-8 py-4 bg-red-500 hover:bg-red-600 text-white font-black text-lg border-4 border-black shadow-retro hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-retro-hover active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all uppercase"
          >
            <Play className="w-6 h-6 fill-current" />
            Start
          </button>
        )}

        {status === "recording" && (
          <>
            <button
              onClick={onPause}
              aria-keyshortcuts="p"
              aria-label="Pause recording (P)"
              className="flex items-center gap-3 px-8 py-4 bg-yellow-400 hover:bg-yellow-500 text-black font-black text-lg border-4 border-black shadow-retro hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-retro-hover active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all uppercase"
            >
              <Pause className="w-6 h-6" />
              Pause
            </button>
            <button
              onClick={onStop}
              aria-keyshortcuts="s"
              aria-label="Stop recording (S)"
              className="flex items-center gap-3 px-8 py-4 bg-black hover:bg-gray-800 text-white font-black text-lg border-4 border-black shadow-retro hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-retro-hover active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all uppercase"
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
              aria-keyshortcuts="r"
              aria-label="Resume recording (R)"
              className="flex items-center gap-3 px-8 py-4 bg-green-400 hover:bg-green-500 text-black font-black text-lg border-4 border-black shadow-retro hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-retro-hover active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all uppercase"
            >
              <Play className="w-6 h-6 fill-current" />
              Resume
            </button>
            <button
              onClick={onStop}
              aria-keyshortcuts="s"
              aria-label="Stop recording (S)"
              className="flex items-center gap-3 px-8 py-4 bg-black hover:bg-gray-800 text-white font-black text-lg border-4 border-black shadow-retro hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-retro-hover active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all uppercase"
            >
              <Square className="w-6 h-6" />
              Stop
            </button>
          </>
        )}

        {status === "processing" && (
          <div className="flex items-center gap-3 px-8 py-4 bg-blue-400 text-black font-black text-lg border-4 border-black shadow-retro uppercase">
            <div className="w-6 h-6 border-4 border-black border-t-transparent animate-spin" />
            Processing...
          </div>
        )}
      </div>

      {/* Help Text */}
      <div className="text-center text-sm font-bold uppercase tracking-wide">
        {status === "idle" && audioSource === "mic" && (
          <div className="space-y-2">
            <p>Click "Start" to capture audio from your microphone</p>
            <div className="text-xs p-3 bg-orange-100 dark:bg-orange-900/30 border-2 border-orange-500 mt-2">
              <p className="font-bold">⚠️ For Meeting Audio:</p>
              <p>Switch to "Browser Tab" source to capture web meeting audio!</p>
              <p className="mt-1">(Microphone only records YOUR voice, not the meeting)</p>
            </div>
          </div>
        )}
        {status === "idle" && audioSource === "tab" && (
          <div className="space-y-2">
            <p>Click "Start" and select a browser tab to capture its audio</p>
            <div className="text-xs p-3 bg-green-100 dark:bg-green-900/30 border-2 border-green-500 mt-2">
              <p className="font-bold">✓ Meeting Audio Mode</p>
              <p>This will capture audio from Google Meet, Zoom, Teams, etc.</p>
              <p className="mt-1">Select the meeting tab when prompted!</p>
            </div>
          </div>
        )}
        {status === "recording" && (
          <div className="space-y-2">
            <p>Recording in progress... Click "Pause" or "Stop"</p>
            <div className="text-xs p-3 bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-500 mt-2">
              <p className="font-bold">📊 Processing metadata in real-time</p>
              <p>Formatted transcript will be available after stopping</p>
            </div>
          </div>
        )}
        {status === "paused" && (
          <p>Recording paused. Click "Resume" to continue or "Stop" to finish</p>
        )}
        {status === "processing" && (
          <div className="space-y-2">
            <p>Processing your recording... Please wait</p>
            <div className="text-xs p-3 bg-purple-100 dark:bg-purple-900/30 border-2 border-purple-500 mt-2">
              <p className="font-bold">🤖 Generating formatted transcript with AI</p>
              <p>Creating concise point-by-point summary...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Keyboard bindings: R = Start/Resume, P = Pause, S = Stop
export function useRecordingKeyboardShortcuts(
  status: RecordingStatus,
  onStart: () => void,
  onPause: () => void,
  onResume: () => void,
  onStop: () => void
) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "r" || e.key === "R") {
        if (status === "idle") onStart();
        else if (status === "paused") onResume();
      }
      if (e.key === "p" || e.key === "P") {
        if (status === "recording") onPause();
      }
      if (e.key === "s" || e.key === "S") {
        if (status === "recording" || status === "paused") onStop();
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [status, onStart, onPause, onResume, onStop]);
}
