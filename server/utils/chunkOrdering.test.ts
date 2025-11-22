import { describe, it, expect } from "vitest";

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

describe("Chunk Ordering Utilities", () => {
  describe("sortChunksBySequence", () => {
    it("should sort chunks in ascending order by sequence number", () => {
      const chunks = [
        { seq: 3, data: "third" },
        { seq: 1, data: "first" },
        { seq: 2, data: "second" },
      ];

      const sorted = sortChunksBySequence(chunks);

      expect(sorted[0].seq).toBe(1);
      expect(sorted[1].seq).toBe(2);
      expect(sorted[2].seq).toBe(3);
    });

    it("should handle out-of-order arrivals correctly", () => {
      const chunks = [
        { seq: 5, data: "fifth" },
        { seq: 0, data: "zero" },
        { seq: 3, data: "third" },
        { seq: 1, data: "first" },
        { seq: 4, data: "fourth" },
        { seq: 2, data: "second" },
      ];

      const sorted = sortChunksBySequence(chunks);

      expect(sorted.map((c) => c.seq)).toEqual([0, 1, 2, 3, 4, 5]);
    });

    it("should not mutate original array", () => {
      const chunks = [
        { seq: 3, data: "third" },
        { seq: 1, data: "first" },
      ];

      const original = [...chunks];
      sortChunksBySequence(chunks);

      expect(chunks).toEqual(original);
    });

    it("should handle empty array", () => {
      const chunks: { seq: number }[] = [];
      const sorted = sortChunksBySequence(chunks);

      expect(sorted).toEqual([]);
    });

    it("should handle single chunk", () => {
      const chunks = [{ seq: 5, data: "only" }];
      const sorted = sortChunksBySequence(chunks);

      expect(sorted).toEqual(chunks);
    });

    it("should handle chunks with duplicate sequence numbers", () => {
      const chunks = [
        { seq: 2, data: "second-a" },
        { seq: 1, data: "first" },
        { seq: 2, data: "second-b" },
      ];

      const sorted = sortChunksBySequence(chunks);

      expect(sorted.length).toBe(3);
      expect(sorted[0].seq).toBe(1);
      expect(sorted[1].seq).toBe(2);
      expect(sorted[2].seq).toBe(2);
    });
  });

  describe("findMissingSequences", () => {
    it("should detect missing sequences in continuous range", () => {
      const chunks = [{ seq: 0 }, { seq: 1 }, { seq: 3 }, { seq: 5 }];

      const missing = findMissingSequences(chunks);

      expect(missing).toEqual([2, 4]);
    });

    it("should return empty array for complete sequence", () => {
      const chunks = [{ seq: 0 }, { seq: 1 }, { seq: 2 }, { seq: 3 }];

      const missing = findMissingSequences(chunks);

      expect(missing).toEqual([]);
    });

    it("should handle non-zero starting sequence", () => {
      const chunks = [{ seq: 10 }, { seq: 12 }, { seq: 14 }];

      const missing = findMissingSequences(chunks);

      expect(missing).toEqual([11, 13]);
    });

    it("should handle empty array", () => {
      const chunks: { seq: number }[] = [];
      const missing = findMissingSequences(chunks);

      expect(missing).toEqual([]);
    });

    it("should work with out-of-order input", () => {
      const chunks = [{ seq: 5 }, { seq: 1 }, { seq: 3 }];

      const missing = findMissingSequences(chunks);

      expect(missing).toEqual([2, 4]);
    });
  });

  describe("validateChunkIntegrity", () => {
    it("should validate complete and ordered chunks as valid", () => {
      const chunks = [{ seq: 0 }, { seq: 1 }, { seq: 2 }];

      const result = validateChunkIntegrity(chunks);

      expect(result.isValid).toBe(true);
      expect(result.missingSequences).toEqual([]);
      expect(result.hasDuplicates).toBe(false);
      expect(result.isSorted).toBe(true);
    });

    it("should detect missing sequences", () => {
      const chunks = [{ seq: 0 }, { seq: 2 }, { seq: 3 }];

      const result = validateChunkIntegrity(chunks);

      expect(result.isValid).toBe(false);
      expect(result.missingSequences).toEqual([1]);
    });

    it("should detect duplicate sequences", () => {
      const chunks = [{ seq: 0 }, { seq: 1 }, { seq: 1 }, { seq: 2 }];

      const result = validateChunkIntegrity(chunks);

      expect(result.hasDuplicates).toBe(true);
      expect(result.isValid).toBe(false);
    });

    it("should detect unsorted chunks", () => {
      const chunks = [{ seq: 0 }, { seq: 2 }, { seq: 1 }];

      const result = validateChunkIntegrity(chunks);

      expect(result.isSorted).toBe(false);
    });

    it("should handle chunks arriving out of order but complete", () => {
      const chunks = [{ seq: 2 }, { seq: 0 }, { seq: 1 }];

      const result = validateChunkIntegrity(chunks);

      expect(result.isValid).toBe(true);
      expect(result.missingSequences).toEqual([]);
      expect(result.hasDuplicates).toBe(false);
      expect(result.isSorted).toBe(false); 
    });
  });
});

describe("Real-world Chunk Processing Scenarios", () => {
  it("should handle network-delayed chunks arriving out of order", () => {
    const arrivedChunks = [
      { seq: 0, timestamp: 1000 },
      { seq: 1, timestamp: 2000 },
      { seq: 2, timestamp: 3000 },
      { seq: 4, timestamp: 5000 },
      { seq: 5, timestamp: 6000 },
      { seq: 3, timestamp: 4000 }, 
    ];

    const sorted = sortChunksBySequence(arrivedChunks);
    const integrity = validateChunkIntegrity(sorted);

    expect(sorted.map((c) => c.seq)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(integrity.isValid).toBe(true);
    expect(integrity.missingSequences).toEqual([]);
  });

  it("should identify gaps for failed uploads", () => {
    // Chunk 3 failed to upload
    const chunks = [{ seq: 0 }, { seq: 1 }, { seq: 2 }, { seq: 4 }, { seq: 5 }];

    const integrity = validateChunkIntegrity(chunks);

    expect(integrity.isValid).toBe(false);
    expect(integrity.missingSequences).toEqual([3]);
  });

  it("should handle retry scenario with duplicate sequences", () => {
    const chunks = [
      { seq: 0 },
      { seq: 1 },
      { seq: 2 },
      { seq: 2 }, 
      { seq: 3 },
    ];

    const integrity = validateChunkIntegrity(chunks);

    expect(integrity.hasDuplicates).toBe(true);
    expect(integrity.isValid).toBe(false);
  });
});
