/**
 * Audio Recording Utilities
 *
 * This module provides utilities for capturing audio from:
 * 1. Microphone (getUserMedia)
 * 2. Browser Tab (getDisplayMedia)
 *
 * Features:
 * - Configurable chunk duration (default 10s)
 * - Automatic blob generation
 * - Error handling and fallbacks
 * - Stream cleanup
 */

export interface AudioRecorderOptions {
  /**
   * Duration of each audio chunk in milliseconds
   * @default 30000 (30 seconds)
   */
  chunkDuration?: number;

  /**
   * MIME type for audio encoding
   * @default "audio/webm;codecs=opus"
   */
  mimeType?: string;

  /**
   * Audio bitrate in bits per second
   * @default 128000 (128 kbps)
   */
  audioBitsPerSecond?: number;
}

export interface AudioChunkData {
  blob: Blob;
  sequence: number;
  timestamp: number;
  duration: number;
}

export interface AudioRecorderResult {
  stream: MediaStream;
  recorder: MediaRecorder;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  getRecordingStartTime: () => number;
}

/**
 * Start recording audio from the user's microphone
 *
 * @param onChunk - Callback fired when a new audio chunk is ready
 * @param options - Recording configuration options
 * @returns Audio recorder controls and stream
 *
 * @example
 * ```ts
 * const recorder = await startMicRecording((chunkData) => {
 *   console.log(`Chunk ${chunkData.sequence} at ${chunkData.timestamp}ms`);
 *   // Upload blob to server
 * });
 *
 * // Later...
 * recorder.stop();
 * ```
 */
export async function startMicRecording(
  onChunk: (chunkData: AudioChunkData) => void,
  options: AudioRecorderOptions = {}
): Promise<AudioRecorderResult> {
  const {
    chunkDuration = 30000, // Default to 30 seconds
    mimeType = "audio/webm;codecs=opus",
    audioBitsPerSecond = 128000,
  } = options;

  // Track recording start time for timestamping
  const recordingStartTime = Date.now();
  let sequence = 0;

  // Request microphone access
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 48000,
      },
      video: false,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "NotAllowedError") {
        throw new Error("Microphone access denied. Please grant permission and try again.");
      } else if (error.name === "NotFoundError") {
        throw new Error("No microphone found. Please connect a microphone and try again.");
      }
    }
    throw new Error(`Failed to access microphone: ${error}`);
  }

  // Check MIME type support
  const supportedMimeType = MediaRecorder.isTypeSupported(mimeType) ? mimeType : "audio/webm";

  // Create MediaRecorder
  const recorder = new MediaRecorder(stream, {
    mimeType: supportedMimeType,
    audioBitsPerSecond,
  });

  // Handle data available (chunk ready)
  recorder.ondataavailable = (event) => {
    // Filter out tiny/corrupt chunks (less than 1KB is likely corrupt)
    if (event.data.size > 1000) {
      const timestamp = Date.now() - recordingStartTime;
      console.log(`[AudioRecorder] Chunk ${sequence} ready: ${event.data.size} bytes`);
      onChunk({
        blob: event.data,
        sequence: sequence++,
        timestamp,
        duration: chunkDuration,
      });
    } else if (event.data.size > 0) {
      console.warn(`[AudioRecorder] ⚠️ Skipping tiny/corrupt chunk (${event.data.size} bytes) - likely stop() artifact`);
    }
  };

  // Handle recording stop - request final chunk
  recorder.onstop = () => {
    console.log(`[AudioRecorder] Recording stopped, requesting final data`);
    // The ondataavailable will fire automatically with remaining data
  };

  // Handle errors
  recorder.onerror = (event) => {
    console.error("MediaRecorder error:", event);
  };

  // Start recording with time slicing (generates chunks every chunkDuration ms)
  console.log(`[AudioRecorder] Starting MediaRecorder with ${chunkDuration}ms chunks`);
  recorder.start(chunkDuration);

  // Return control interface
  return {
    stream,
    recorder,
    stop: () => {
      if (recorder.state !== "inactive") {
        console.log(`[AudioRecorder] Stopping recorder (no final chunk request to avoid corruption)`);
        // DON'T call requestData() - it creates corrupt final chunks
        recorder.stop();
      }
      stream.getTracks().forEach((track) => track.stop());
    },
    pause: () => {
      if (recorder.state === "recording") {
        recorder.pause();
      }
    },
    resume: () => {
      if (recorder.state === "paused") {
        recorder.resume();
      }
    },
    getRecordingStartTime: () => recordingStartTime,
  };
}

/**
 * Start recording audio from a browser tab (screen/tab share)
 *
 * Falls back to microphone if tab audio capture is not allowed or fails.
 *
 * @param onChunk - Callback fired when a new audio chunk is ready
 * @param options - Recording configuration options
 * @returns Audio recorder controls and stream
 *
 * @example
 * ```ts
 * try {
 *   const recorder = await startTabRecording((chunkData) => {
 *     console.log(`Tab chunk ${chunkData.sequence} at ${chunkData.timestamp}ms`);
 *   });
 * } catch (error) {
 *   console.error("Failed to start tab recording:", error);
 * }
 * ```
 */
export async function startTabRecording(
  onChunk: (chunkData: AudioChunkData) => void,
  options: AudioRecorderOptions = {}
): Promise<AudioRecorderResult> {
  const {
    chunkDuration = 30000, // Default to 30 seconds
    mimeType = "audio/webm;codecs=opus",
    audioBitsPerSecond = 128000,
  } = options;

  // Track recording start time for timestamping
  const recordingStartTime = Date.now();
  let sequence = 0;

  let stream: MediaStream;

  try {
    // Request display media with audio
    // CRITICAL: video must be true for audio to work with getDisplayMedia
    stream = await navigator.mediaDevices.getDisplayMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 48000,
        autoGainControl: true,
      } as any,
      video: true, // MUST be true for browser tab audio capture
    });

    console.log(`[AudioRecorder:Tab] Stream obtained. Tracks:`, {
      audio: stream.getAudioTracks().length,
      video: stream.getVideoTracks().length,
    });

    // Remove video track if present (we only want audio)
    const videoTracks = stream.getVideoTracks();
    videoTracks.forEach((track) => {
      console.log(`[AudioRecorder:Tab] Removing video track: ${track.label}`);
      track.stop();
      stream.removeTrack(track);
    });

    // Check if audio track is present
    const audioTracks = stream.getAudioTracks();
    console.log(
      `[AudioRecorder:Tab] Audio tracks:`,
      audioTracks.map((t) => ({
        label: t.label,
        enabled: t.enabled,
        muted: t.muted,
        readyState: t.readyState,
      }))
    );

    if (audioTracks.length === 0) {
      // No audio track, fall back to microphone
      console.warn(
        "[AudioRecorder:Tab] Selected source has no audio. Falling back to microphone..."
      );
      stream.getTracks().forEach((track) => track.stop());
      throw new Error("NO_AUDIO_IN_TAB");
    }

    // Verify audio track is active
    if (audioTracks[0].readyState !== "live") {
      console.warn("[AudioRecorder:Tab] Audio track not live. Falling back to microphone...");
      stream.getTracks().forEach((track) => track.stop());
      throw new Error("AUDIO_TRACK_NOT_LIVE");
    }

    console.log(`[AudioRecorder:Tab] ✓ Audio track verified and ready`);
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "NotAllowedError") {
        console.warn("Tab sharing cancelled or denied. Falling back to microphone...");
      } else {
        console.warn(`Tab sharing failed: ${error.message}. Falling back to microphone...`);
      }
    }
    // Fall back to microphone
    return startMicRecording(onChunk, options);
  }

  // Check MIME type support
  const supportedMimeType = MediaRecorder.isTypeSupported(mimeType) ? mimeType : "audio/webm";

  // Create MediaRecorder
  const recorder = new MediaRecorder(stream, {
    mimeType: supportedMimeType,
    audioBitsPerSecond,
  });

  // Handle data available (chunk ready)
  recorder.ondataavailable = (event) => {
    // Filter out tiny/corrupt chunks (less than 1KB is likely corrupt)
    if (event.data.size > 1000) {
      const timestamp = Date.now() - recordingStartTime;
      console.log(
        `[AudioRecorder:Tab] Chunk ${sequence} ready: ${event.data.size} bytes, type: ${event.data.type}`
      );

      onChunk({
        blob: event.data,
        sequence: sequence++,
        timestamp,
        duration: chunkDuration,
      });
    } else if (event.data.size > 0) {
      console.warn(
        `[AudioRecorder:Tab] ⚠️ Skipping tiny/corrupt chunk (${event.data.size} bytes) - likely stop() artifact`
      );
    }
  };

  // Handle recording stop
  recorder.onstop = () => {
    console.log(`[AudioRecorder:Tab] Recording stopped`);
  };

  // Handle errors
  recorder.onerror = (event) => {
    console.error("MediaRecorder error:", event);
  };

  // Handle stream ending (user stops sharing)
  stream.getAudioTracks().forEach((track) => {
    track.onended = () => {
      console.log("Tab sharing stopped by user");
      if (recorder.state !== "inactive") {
        recorder.stop();
      }
    };
  });

  // Start recording with time slicing
  console.log(`[AudioRecorder:Tab] Starting MediaRecorder with ${chunkDuration}ms chunks`);
  recorder.start(chunkDuration);

  // Return control interface
  return {
    stream,
    recorder,
    stop: () => {
      if (recorder.state !== "inactive") {
        console.log(`[AudioRecorder:Tab] Stopping recorder (no final chunk request to avoid corruption)`);
        // DON'T call requestData() - it creates corrupt final chunks
        recorder.stop();
      }
      stream.getTracks().forEach((track) => track.stop());
    },
    pause: () => {
      if (recorder.state === "recording") {
        recorder.pause();
      }
    },
    resume: () => {
      if (recorder.state === "paused") {
        recorder.resume();
      }
    },
    getRecordingStartTime: () => recordingStartTime,
  };
}

/**
 * Check if the browser supports audio recording
 *
 * @returns Object with support flags for various features
 */
export function checkAudioSupport() {
  return {
    getUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
    getDisplayMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia),
    mediaRecorder: typeof MediaRecorder !== "undefined",
    webm: MediaRecorder?.isTypeSupported?.("audio/webm"),
    opus: MediaRecorder?.isTypeSupported?.("audio/webm;codecs=opus"),
  };
}
