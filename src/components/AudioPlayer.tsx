"use client";

import { useState, useRef, useEffect } from "react";
import { Play, Pause, Download, AlertCircle } from "lucide-react";

interface AudioPlayerProps {
  sessionId: string;
  sessionTitle?: string;
}

export function AudioPlayer({ sessionId, sessionTitle }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [audioAvailable, setAudioAvailable] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const audioUrl = `/api/sessions/${sessionId}/audio`;

  // Check if audio is available
  useEffect(() => {
    const checkAudio = async () => {
      try {
        const response = await fetch(audioUrl, { method: "HEAD" });
        if (response.ok) {
          setAudioAvailable(true);
          setError(null);
        } else {
          setAudioAvailable(false);
          setError("Audio not yet available. Recording may still be processing.");
        }
      } catch (err) {
        setAudioAvailable(false);
        setError("Failed to check audio availability.");
      } finally {
        setIsLoading(false);
      }
    };

    checkAudio();
  }, [audioUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioAvailable) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleDurationChange = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);
    const handleLoadStart = () => setIsLoading(true);
    const handleCanPlay = () => {
      setIsLoading(false);
      setError(null);
    };
    const handleError = (e: Event) => {
      const target = e.target as HTMLAudioElement;
      const errorCode = target.error?.code;
      let errorMsg = "Failed to load audio.";

      if (errorCode === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
        errorMsg = "Audio format not supported or file missing.";
      } else if (errorCode === MediaError.MEDIA_ERR_NETWORK) {
        errorMsg = "Network error while loading audio.";
      }

      setError(errorMsg);
      setIsLoading(false);
      setAudioAvailable(false);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("loadstart", handleLoadStart);
    audio.addEventListener("canplay", handleCanPlay);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("loadstart", handleLoadStart);
      audio.removeEventListener("canplay", handleCanPlay);
      audio.removeEventListener("error", handleError);
    };
  }, [audioAvailable]);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const newTime = parseFloat(e.target.value);
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(audioUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${sessionTitle || sessionId}.webm`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Download failed:", error);
      setError("Failed to download audio");
    }
  };

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="bg-white dark:bg-gray-900 border-4 border-black dark:border-white shadow-retro p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-black uppercase">{sessionTitle || "Audio Playback"}</h3>
          <p className="text-sm font-bold opacity-60">ID: {sessionId.slice(0, 8)}...</p>
        </div>
        {audioAvailable && (
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2 bg-retro-accent border-4 border-black font-bold shadow-retro hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-retro-hover transition-all uppercase"
            title="Download audio"
          >
            <Download className="w-4 h-4" />
            Save
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-yellow-100 border-4 border-yellow-500 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="text-sm font-bold">{error}</p>
        </div>
      )}

      {!audioAvailable && !isLoading ? (
        <div className="p-6 bg-gray-100 dark:bg-gray-800 border-2 border-gray-400 text-center">
          <p className="font-bold">
            Audio not available yet. Recording may still be processing or no chunks were recorded.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Hidden audio element */}
          {audioAvailable && <audio ref={audioRef} src={audioUrl} preload="metadata" />}

          {/* Play/Pause button */}
          <div className="flex items-center gap-4">
            <button
              onClick={togglePlayPause}
              disabled={isLoading || !audioAvailable}
              className="w-12 h-12 flex items-center justify-center bg-retro-primary border-4 border-black shadow-retro hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-retro-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-4 border-black border-t-transparent animate-spin" />
              ) : isPlaying ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5 ml-0.5" />
              )}
            </button>

            {/* Time display */}
            <div className="flex-1">
              <div className="flex items-center justify-between text-sm font-bold mb-2">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>

              {/* Progress bar */}
              <input
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime}
                onChange={handleSeek}
                disabled={!audioAvailable}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 border-2 border-black appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-retro-primary [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-black"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
