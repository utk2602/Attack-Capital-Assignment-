# Gemini Prompt Presets

These prompts are optimized for Gemini 1.5 Pro to handle various stages of the transcription pipeline.

## 1. Chunk Transcription

**Goal**: Transcribe a short audio segment accurately, preserving context.

```text
You are an expert transcriber. Transcribe the following audio chunk.
- Context: This is chunk #{seq} of a recording session.
- Previous context: "{previous_transcript_tail}"
- Output format: JSON with "text", "confidence" (0-1), and "speakers" (list).
- Guidelines:
  - Do not hallucinate words.
  - If audio is silent or unclear, return empty text.
  - Identify speakers as SPEAKER_1, SPEAKER_2, etc. consistent with context.
```

## 2. Diarization Merge

**Goal**: Consolidate multiple chunks and unify speaker labels.

```text
Analyze the following sequence of transcript chunks.
[
  { "seq": 1, "text": "Hello...", "speaker": "SPEAKER_A" },
  { "seq": 2, "text": "Hi there.", "speaker": "SPEAKER_B" }
]
Task:
1. Merge the text into a coherent dialogue.
2. Standardize speaker labels (e.g., if SPEAKER_A and SPEAKER_1 are likely the same person based on voice/context, merge them).
3. Return the full corrected transcript with timestamps.
```

## 3. Final Summary & Action Items

**Goal**: Generate a structured meeting summary.

```text
Based on the full transcript provided below, generate a structured summary.
Output Format (Markdown):
# Executive Summary
(2-3 sentences)

# Key Points
- Point 1
- Point 2

# Action Items
- [ ] Task (Owner) - Due Date
- [ ] Task (Owner) - Due Date

# Decisions Made
- Decision 1
- Decision 2

Transcript:
{full_transcript_text}
```

## 4. Noisy Audio Guide

**Goal**: Extract speech from background noise.

```text
The following audio contains speech with heavy background noise (traffic/wind/music).
Focus ONLY on the human voice.
- Ignore background sounds.
- If a word is unintelligible, mark it as [inaudible].
- Do not guess.
Transcribe the speech.
```

## 5. Speaker Label Correction

**Goal**: Assign real names to speaker labels after user input.

```text
Current Transcript:
SPEAKER_1: Welcome everyone.
SPEAKER_2: Thanks for having me.

User Mapping:
SPEAKER_1 = "Alice"
SPEAKER_2 = "Bob"

Task:
Rewrite the transcript replacing speaker labels with the provided names.
Ensure the format remains: "Name: Text".
```
