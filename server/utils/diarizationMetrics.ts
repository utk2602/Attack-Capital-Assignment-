export interface SpeakerSegment {
  speaker: string | null;
  start: number; // seconds
  end: number; // seconds
  text?: string;
}

export interface DiarizationMetrics {
  speakerChangePercent: number; // percent of boundaries that change speaker
  avgSegmentDurationSec: number;
  unknownSpeakerRate: number; // percent segments with null/unknown speaker
  speakerCount: number;
  score: number; // 0-100 quality score (heuristic)
}

/**
 * Compute simple diarization quality heuristics from segments
 */
export function computeDiarizationMetrics(segments: SpeakerSegment[]): DiarizationMetrics {
  if (!segments || segments.length === 0) {
    return {
      speakerChangePercent: 0,
      avgSegmentDurationSec: 0,
      unknownSpeakerRate: 0,
      speakerCount: 0,
      score: 0,
    };
  }

  const totalBoundaries = Math.max(segments.length - 1, 1);
  let changes = 0;
  let totalDuration = 0;
  let unknownCount = 0;
  const speakers = new Set<string>();

  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    totalDuration += Math.max(0, s.end - s.start);
    if (!s.speaker || s.speaker === "SPEAKER_UNKNOWN") unknownCount++;
    if (s.speaker) speakers.add(s.speaker);
    if (i > 0) {
      const prev = segments[i - 1];
      if (prev.speaker !== s.speaker) changes++;
    }
  }

  const speakerChangePercent = (changes / totalBoundaries) * 100;
  const avgSegmentDurationSec = totalDuration / segments.length;
  const unknownSpeakerRate = (unknownCount / segments.length) * 100;
  const speakerCount = speakers.size;

  // Heuristic scoring: prefer lower speaker change percent (less flip-flopping), longer segments, few unknowns
  // Score from 0..100
  const changeScore = Math.max(0, 100 - speakerChangePercent); // 0..100
  const durationScore = Math.min(100, Math.floor(avgSegmentDurationSec * 10)); // scale up
  const unknownPenalty = Math.max(0, 100 - unknownSpeakerRate * 2);

  // Weighted average
  const score = Math.round(changeScore * 0.5 + durationScore * 0.3 + unknownPenalty * 0.2);

  return {
    speakerChangePercent: Math.round(speakerChangePercent * 100) / 100,
    avgSegmentDurationSec: Math.round(avgSegmentDurationSec * 100) / 100,
    unknownSpeakerRate: Math.round(unknownSpeakerRate * 100) / 100,
    speakerCount,
    score: Math.max(0, Math.min(100, score)),
  };
}
