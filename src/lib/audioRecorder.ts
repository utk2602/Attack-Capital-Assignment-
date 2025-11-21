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
   * @default 10000 (10 seconds)
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

export interface AudioRecorderResult {
  stream: MediaStream;
  recorder: MediaRecorder;
  stop: () => void;
  pause: () => void;
  resume: () => void;
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
 * const recorder = await startMicRecording((blob, seq) => {
 *   console.log(`Received chunk ${seq}, size: ${blob.size} bytes`);
 *   // Upload blob to server
 * });
 *
 * // Later...
 * recorder.stop();
 * ```
 */
export async function startMicRecording(
  onChunk: (blob: Blob, sequence: number) => void,
  options: AudioRecorderOptions = {}
): Promise<AudioRecorderResult> {
  const {
    chunkDuration = 10000,
    mimeType = "audio/webm;codecs=opus",
    audioBitsPerSecond = 128000,
  } = options;

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

  let sequence = 0;

  // Handle data available (chunk ready)
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      onChunk(event.data, sequence++);
    }
  };

  // Handle errors
  recorder.onerror = (event) => {
    console.error("MediaRecorder error:", event);
  };

  // Start recording with time slicing (generates chunks every chunkDuration ms)
  recorder.start(chunkDuration);

  // Return control interface
  return {
    stream,
    recorder,
    stop: () => {
      if (recorder.state !== "inactive") {
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
 *   const recorder = await startTabRecording((blob, seq) => {
 *     console.log(`Received tab audio chunk ${seq}`);
 *   });
 * } catch (error) {
 *   console.error("Failed to start tab recording:", error);
 * }
 * ```
 */
export async function startTabRecording(
  onChunk: (blob: Blob, sequence: number) => void,
  options: AudioRecorderOptions = {}
): Promise<AudioRecorderResult> {
  const {
    chunkDuration = 10000,
    mimeType = "audio/webm;codecs=opus",
    audioBitsPerSecond = 128000,
  } = options;

  let stream: MediaStream;

  try {
    // Request display media with audio
    stream = await navigator.mediaDevices.getDisplayMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 48000,
      } as any, // Type assertion needed for audio constraints
      video: false as any, // We only want audio, but some browsers require video: true
    });

    // Check if audio track is present
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      // No audio track, fall back to microphone
      console.warn("Selected tab has no audio. Falling back to microphone...");
      stream.getTracks().forEach((track) => track.stop());
      return startMicRecording(onChunk, options);
    }
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

  let sequence = 0;

  // Handle data available (chunk ready)
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      onChunk(event.data, sequence++);
    }
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
  recorder.start(chunkDuration);

  // Return control interface
  return {
    stream,
    recorder,
    stop: () => {
      if (recorder.state !== "inactive") {
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
