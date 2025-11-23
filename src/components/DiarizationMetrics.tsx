"use client";

import React from "react";
import { computeDiarizationMetrics, SpeakerSegment } from "@/../server/utils/diarizationMetrics";

interface Props {
  segments: SpeakerSegment[];
}

export default function DiarizationMetrics({ segments }: Props) {
  const metrics = computeDiarizationMetrics(segments as any);

  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Diarization Quality</h3>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <div className="text-sm text-gray-500">Speaker Changes</div>
          <div className="text-xl font-medium">{metrics.speakerChangePercent}%</div>
        </div>
        <div>
          <div className="text-sm text-gray-500">Avg Segment (s)</div>
          <div className="text-xl font-medium">{metrics.avgSegmentDurationSec}s</div>
        </div>
        <div>
          <div className="text-sm text-gray-500">Unknown Speaker Rate</div>
          <div className="text-xl font-medium">{metrics.unknownSpeakerRate}%</div>
        </div>
        <div>
          <div className="text-sm text-gray-500">Speaker Count</div>
          <div className="text-xl font-medium">{metrics.speakerCount}</div>
        </div>
      </div>

      <div className="mt-4">
        <div className="text-sm text-gray-500">Quality Score</div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mt-1">
          <div className="h-3 rounded-full bg-green-500" style={{ width: `${metrics.score}%` }} />
        </div>
        <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">{metrics.score}/100</div>
      </div>

      <div className="mt-4">
        <details>
          <summary className="cursor-pointer text-sm text-gray-600 dark:text-gray-300">
            Review segments
          </summary>
          <ul className="mt-2 space-y-2">
            {segments.map((s, i) => (
              <li key={i} className="p-2 rounded bg-gray-50 dark:bg-gray-700">
                <div className="text-sm text-gray-500">
                  {s.speaker || "SPEAKER_UNKNOWN"} • {s.start}s - {s.end}s
                </div>
                <div className="text-sm text-gray-800 dark:text-gray-200">
                  {s.text || "(no text)"}
                </div>
              </li>
            ))}
          </ul>
        </details>
      </div>
    </div>
  );
}
