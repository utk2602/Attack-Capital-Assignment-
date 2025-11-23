
export function sortChunksBySequence<T extends { seq: number }>(chunks: T[]): T[] {
  return [...chunks].sort((a, b) => a.seq - b.seq);
}
export function findMissingSequences(chunks: { seq: number }[]): number[] {
  if (chunks.length === 0) return [];

  const sorted = sortChunksBySequence(chunks);
  const missing: number[] = [];
  const minSeq = sorted[0].seq;
  const maxSeq = sorted[sorted.length - 1].seq;

  for (let i = minSeq; i <= maxSeq; i++) {
    if (!sorted.find((chunk) => chunk.seq === i)) {
      missing.push(i);
    }
  }

  return missing;
}

export function validateChunkIntegrity(chunks: { seq: number }[]): {
  isValid: boolean;
  missingSequences: number[];
  hasDuplicates: boolean;
  isSorted: boolean;
} {
  const sequences = chunks.map((c) => c.seq);
  const uniqueSequences = new Set(sequences);

  return {
    isValid: uniqueSequences.size === chunks.length && findMissingSequences(chunks).length === 0,
    missingSequences: findMissingSequences(chunks),
    hasDuplicates: uniqueSequences.size !== chunks.length,
    isSorted: chunks.every((chunk, i) => i === 0 || chunk.seq > chunks[i - 1].seq),
  };
}
