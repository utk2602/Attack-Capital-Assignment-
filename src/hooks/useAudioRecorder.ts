"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  startMicRecording,
  startTabRecording,
  AudioRecorderResult,
  AudioRecorderOptions,
  AudioChunkData,
} from "@/lib/audioRecorder";

export type RecordingStatus = "idle" | "recording" | "paused" | "processing";
export type AudioSource = "mic" | "tab";

interface UseAudioRecorderOptions extends AudioRecorderOptions {
  /**
   * Callback fired when a new audio chunk is ready
   */
  onChunk?: (chunkData: AudioChunkData) => void;

  /**
   * Callback fired when recording starts
   */
  onStart?: () => void;

  /**
   * Callback fired when recording is paused
   */
  onPause?: () => void;

  /**
   * Callback fired when recording is resumed
   */
  onResume?: () => void;

  /**
   * Callback fired when recording stops
   */
  onStop?: () => void;

  /**
   * Callback fired when an error occurs
   */
  onError?: (error: Error) => void;
}

export function useAudioRecorder(options: UseAudioRecorderOptions = {}) {
  const [status, setStatus] = useState<RecordingStatus>("idle");
  const [audioSource, setAudioSource] = useState<AudioSource>("mic");
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<AudioRecorderResult | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const { onChunk, onStart, onPause, onResume, onStop, onError, ...recorderOptions } = options;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recorderRef.current) {
        recorderRef.current.stop();
        recorderRef.current = null;
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  // Start duration timer
  const startTimer = useCallback(() => {
    timerRef.current = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);
  }, []);

  // Stop duration timer
  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Start recording
  const start = useCallback(async () => {
    try {
      setError(null);
      setStatus("recording");
      setDuration(0);

      const handleChunk = (chunkData: AudioChunkData) => {
        onChunk?.(chunkData);
      };

      const recorder =
        audioSource === "mic"
          ? await startMicRecording(handleChunk, recorderOptions)
          : await startTabRecording(handleChunk, recorderOptions);

      recorderRef.current = recorder;
      startTimer();
      onStart?.();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error.message);
      setStatus("idle");
      onError?.(error);
    }
  }, [audioSource, onChunk, onStart, onError, recorderOptions, startTimer]);

  // Pause recording
  const pause = useCallback(() => {
    if (recorderRef.current && status === "recording") {
      recorderRef.current.pause();
      setStatus("paused");
      stopTimer();
      onPause?.();
    }
  }, [status, stopTimer, onPause]);

  // Resume recording
  const resume = useCallback(() => {
    if (recorderRef.current && status === "paused") {
      recorderRef.current.resume();
      setStatus("recording");
      startTimer();
      onResume?.();
    }
  }, [status, startTimer, onResume]);

  // Stop recording
  const stop = useCallback(() => {
    if (recorderRef.current) {
      recorderRef.current.stop();
      recorderRef.current = null;
    }
    stopTimer();
    setStatus("idle");
    setDuration(0);
    onStop?.();
  }, [stopTimer, onStop]);

  // Change audio source
  const changeSource = useCallback(
    (source: AudioSource) => {
      if (status === "idle") {
        setAudioSource(source);
      }
    },
    [status]
  );

  return {
    // State
    status,
    audioSource,
    duration,
    error,

    // Actions
    start,
    pause,
    resume,
    stop,
    changeSource,

    // Computed
    isRecording: status === "recording",
    isPaused: status === "paused",
    isIdle: status === "idle",
    isProcessing: status === "processing",
  };
}
