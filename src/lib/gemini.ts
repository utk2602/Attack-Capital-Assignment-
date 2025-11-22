import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs/promises";
import path from "path";



interface TranscriptionResult {
  text: string;
  confidence?: number;
  speakers?: string[];
  processingTimeMs: number;
}

interface SummaryResult {
  summary: string;
  keyPoints: string[];
  processingTimeMs: number;
}

interface TranscriptionOptions {
  previousContext?: string;
  enableDiarization?: boolean;
  temperature?: number;
  languageHint?: string;
}

interface SummaryOptions {
  maxLength?: number;
  focusAreas?: string[];
  format?: "paragraph" | "bullets";
}

class GeminiTranscriptionService {
  private genAI: GoogleGenerativeAI;
  private model: string;
  private maxRetries: number;
  private timeoutMs: number;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = process.env.GEMINI_MODEL || "models/gemini-1.5-pro";
    this.maxRetries = parseInt(process.env.GEMINI_MAX_RETRIES || "3", 10);
    this.timeoutMs = parseInt(process.env.GEMINI_TIMEOUT_MS || "30000", 10);
  }

  /**
   * Transcribe a single audio chunk with optional context
   *
   * @param sessionId - Recording session ID
   * @param seq - Chunk sequence number
   * @param audioPath - Path to audio file (WAV format)
   * @param options - Transcription options
   * @returns Promise with transcription result
   *
   * @example
   * ```typescript
   * const result = await gemini.transcribeChunk(
   *   'session_abc123',
   *   5,
   *   './storage/session_abc123/chunk_5.wav',
   *   { previousContext: 'The speaker was discussing...' }
   * );
   * ```
   */
  async transcribeChunk(
    sessionId: string,
    seq: number,
    audioPath: string,
    options: TranscriptionOptions = {}
  ): Promise<TranscriptionResult> {
    const startTime = Date.now();

    try {
      console.log(`[Gemini] Starting transcription: session=${sessionId}, seq=${seq}`);

      const audioBuffer = await fs.readFile(audioPath);
      const audioBase64 = audioBuffer.toString("base64");

      const prompt = this.buildTranscriptionPrompt(options);

      const model = this.genAI.getGenerativeModel({
        model: this.model,
      });

      let lastError: Error | null = null;
      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        try {
          const result = await Promise.race([
            model.generateContent({
              contents: [
                {
                  role: "user",
                  parts: [
                    {
                      inlineData: {
                        mimeType: "audio/wav",
                        data: audioBase64,
                      },
                    },
                    { text: prompt },
                  ],
                },
              ],
              generationConfig: {
                temperature: options.temperature ?? 0.1,
                maxOutputTokens: 2048,
              },
            }),
            this.createTimeout(),
          ]);

          const response = await result.response;
          const text = response.text().trim();
          const speakers = options.enableDiarization ? this.extractSpeakers(text) : undefined;

          const processingTimeMs = Date.now() - startTime;

          console.log(
            `[Gemini] Transcription completed: session=${sessionId}, seq=${seq}, time=${processingTimeMs}ms`
          );

          return {
            text,
            speakers,
            processingTimeMs,
          };
        } catch (error) {
          lastError = error as Error;
          console.warn(`[Gemini] Attempt ${attempt}/${this.maxRetries} failed:`, error);

          if (attempt < this.maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
            await this.sleep(delay);
          }
        }
      }

      throw new Error(
        `Transcription failed after ${this.maxRetries} attempts: ${lastError?.message}`
      );
    } catch (error) {
      console.error(`[Gemini] Transcription error: session=${sessionId}, seq=${seq}`, error);
      throw error;
    }
  }

  /**
   * Transcribe audio from buffer (in-memory)
   *
   * @param sessionId - Recording session ID
   * @param seq - Chunk sequence number
   * @param audioBuffer - Audio data buffer (WAV format)
   * @param options - Transcription options
   * @returns Promise with transcription result
   */
  async transcribeChunkFromBuffer(
    sessionId: string,
    seq: number,
    audioBuffer: Buffer,
    options: TranscriptionOptions = {}
  ): Promise<TranscriptionResult> {
    const startTime = Date.now();

    try {
      const audioBase64 = audioBuffer.toString("base64");
      const prompt = this.buildTranscriptionPrompt(options);
      const model = this.genAI.getGenerativeModel({ model: this.model });
      const result = await model.generateContent({
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  mimeType: "audio/wav",
                  data: audioBase64,
                },
              },
              { text: prompt },
            ],
          },
        ],
        generationConfig: {
          temperature: options.temperature ?? 0.1,
          maxOutputTokens: 2048,
        },
      });

      const response = await result.response;
      const text = response.text().trim();

      const speakers = options.enableDiarization ? this.extractSpeakers(text) : undefined;

      const processingTimeMs = Date.now() - startTime;

      return {
        text,
        speakers,
        processingTimeMs,
      };
    } catch (error) {
      console.error(`[Gemini] Buffer transcription error: session=${sessionId}, seq=${seq}`, error);
      throw error;
    }
  }

  /**
   * Generate summary from full transcript
   *
   * @param sessionId - Recording session ID
   * @param transcript - Full transcript text
   * @param options - Summary options
   * @returns Promise with summary result
   *
   * @example
   * ```typescript
   * const summary = await gemini.summarizeTranscript(
   *   'session_abc123',
   *   fullTranscript,
   *   { maxLength: 150, format: 'bullets' }
   * );
   * ```
   */
  async summarizeTranscript(
    sessionId: string,
    transcript: string,
    options: SummaryOptions = {}
  ): Promise<SummaryResult> {
    const startTime = Date.now();

    try {
      console.log(
        `[Gemini] Starting summarization: session=${sessionId}, length=${transcript.length} chars`
      );

      const prompt = this.buildSummaryPrompt(transcript, options);

      const model = this.genAI.getGenerativeModel({ model: this.model });

      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1024,
        },
      });

      const response = await result.response;
      const summaryText = response.text().trim();

      const keyPoints = this.extractKeyPoints(summaryText);

      const processingTimeMs = Date.now() - startTime;

      console.log(
        `[Gemini] Summarization completed: session=${sessionId}, time=${processingTimeMs}ms`
      );

      return {
        summary: summaryText,
        keyPoints,
        processingTimeMs,
      };
    } catch (error) {
      console.error(`[Gemini] Summarization error: session=${sessionId}`, error);
      throw error;
    }
  }


  private buildTranscriptionPrompt(options: TranscriptionOptions): string {
    const parts: string[] = [
      "You are a professional transcription assistant. Your task is to:",
      "1. Transcribe the audio content accurately with proper punctuation and capitalization",
      "2. Preserve natural speech patterns and filler words when contextually important",
      "3. Format the output as clean, readable text",
    ];

    if (options.enableDiarization) {
      parts.push(
        "4. Identify distinct speakers and label them as [Speaker 1], [Speaker 2], etc.",
        "5. Use the format: [Speaker]: Text"
      );
    }

    if (options.previousContext) {
      parts.push(
        "",
        `Previous context for continuity: "${options.previousContext}"`,
        "",
        "Continue transcribing from where the context left off."
      );
    }

    if (options.languageHint) {
      parts.push("", `Expected language: ${options.languageHint}`);
    }

    parts.push("", "Now transcribe the following audio:");

    return parts.join("\n");
  }


  private buildSummaryPrompt(transcript: string, options: SummaryOptions): string {
    const parts: string[] = ["Summarize the following transcript concisely."];

    if (options.maxLength) {
      parts.push(`Keep the summary under ${options.maxLength} words.`);
    }

    if (options.focusAreas && options.focusAreas.length > 0) {
      parts.push(`Focus on these areas: ${options.focusAreas.join(", ")}.`);
    }

    if (options.format === "bullets") {
      parts.push("Provide key points as bullet points (use - or • for bullets).");
    } else {
      parts.push("Provide a coherent paragraph summary.");
    }

    parts.push("", "Transcript:", transcript);

    return parts.join("\n");
  }

 
  private extractSpeakers(text: string): string[] {
    const speakerPattern = /\[Speaker \d+\]/g;
    const matches = text.match(speakerPattern);
    if (!matches) return [];

    // Return unique speakers
    return Array.from(new Set(matches)).sort();
  }


  private extractKeyPoints(summary: string): string[] {
    const lines = summary.split("\n");
    const keyPoints: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (
        trimmed.startsWith("-") ||
        trimmed.startsWith("•") ||
        trimmed.startsWith("*") ||
        /^\d+\./.test(trimmed)
      ) {
        const point = trimmed.replace(/^[-•*]\s*|\d+\.\s*/, "").trim();
        if (point) {
          keyPoints.push(point);
        }
      }
    }

    return keyPoints;
  }

  private createTimeout(): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Request timeout after ${this.timeoutMs}ms`));
      }, this.timeoutMs);
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const gemini = new GeminiTranscriptionService();

export type { TranscriptionResult, SummaryResult, TranscriptionOptions, SummaryOptions };
