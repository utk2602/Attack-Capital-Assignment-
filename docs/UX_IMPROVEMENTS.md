# Micro-UX Improvements

## 1. Recording Timer

**Problem**: Users lose track of how long they've been recording.
**Solution**: A persistent timer that updates every second.

```tsx
// components/RecordingTimer.tsx
import { useState, useEffect } from "react";

export function RecordingTimer({ startTime }: { startTime: number }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000) % 60;
    const m = Math.floor(ms / 1000 / 60) % 60;
    const h = Math.floor(ms / 1000 / 60 / 60);
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return <div className="font-mono text-xl">{formatTime(elapsed)}</div>;
}
```

## 2. Cancel Confirmation

**Problem**: Accidental clicks on "Stop" or "Cancel" can lose data.
**Solution**: A confirmation modal or "hold to stop" interaction.

```tsx
// components/StopButton.tsx
import { useState } from "react";

export function StopButton({ onStop }: { onStop: () => void }) {
  const [showConfirm, setShowConfirm] = useState(false);

  if (showConfirm) {
    return (
      <div className="flex gap-2">
        <button onClick={onStop} className="bg-red-600 text-white px-4 py-2 rounded">
          Confirm Stop
        </button>
        <button onClick={() => setShowConfirm(false)} className="bg-gray-200 px-4 py-2 rounded">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      className="bg-red-500 text-white px-4 py-2 rounded"
    >
      Stop Recording
    </button>
  );
}
```

## 3. Audio Level Visualizer

**Problem**: Users don't know if their mic is working.
**Solution**: A simple CSS-based volume meter.

```tsx
// components/AudioVisualizer.tsx
import { useEffect, useRef } from "react";

export function AudioVisualizer({ stream }: { stream: MediaStream }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyzer = audioContext.createAnalyser();
    source.connect(analyzer);
    // ... canvas drawing logic ...
  }, [stream]);

  return <canvas ref={canvasRef} className="w-full h-12 bg-gray-900 rounded" />;
}
```

## 4. Toast Notifications

**Problem**: System status changes (saved, error) are missed.
**Solution**: Non-blocking toast notifications.

```tsx
// hooks/useToast.ts
import { toast } from "sonner"; // Recommended library

export const notify = {
  success: (msg: string) => toast.success(msg),
  error: (msg: string) => toast.error(msg),
  loading: (msg: string) => toast.loading(msg),
};
```
