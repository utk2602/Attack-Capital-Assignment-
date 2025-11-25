import ffmpeg from "fluent-ffmpeg";
import path from "path";
import fs from "fs";
import { promisify } from "util";

const unlinkAsync = promisify(fs.unlink);

export interface ConversionOptions {
  sampleRate?: number;
  channels?: number;
  applyFilters?: boolean;
  deleteSource?: boolean;
}

export interface ConversionResult {
  outputPath: string;
  durationSeconds: number;
  fileSizeBytes: number;
  conversionTimeMs: number;
}

// convert webm to wav for gemini api
export async function convertToWav(
  inputPath: string,
  outputPath?: string,
  options: ConversionOptions = {}
): Promise<ConversionResult> {
  const startTime = Date.now();
  const { sampleRate = 16000, channels = 1, applyFilters = false, deleteSource = false } = options;
  if (!outputPath) {
    const parsedPath = path.parse(inputPath);
    outputPath = path.join(parsedPath.dir, `${parsedPath.name}.wav`);
  }
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  return new Promise((resolve, reject) => {
    let command = ffmpeg(inputPath)
      .audioFrequency(sampleRate)
      .audioChannels(channels)
      .audioCodec("pcm_s16le")
      .format("wav");
    if (applyFilters) {
      command = command.audioFilters([
        "highpass=f=200",
        "lowpass=f=3000",
        "volume=1.5",
        "anlmdn=s=0.00001",
      ]);
    }

    command
      .on("start", (commandLine) => {
        console.log(`[FFmpeg] starting conversion: ${commandLine}`);
      })
      .on("progress", (progress) => {
        if (progress.percent) {
          console.log(`[FFmpeg] progress: ${Math.round(progress.percent)}%`);
        }
      })
      .on("end", async () => {
        const conversionTimeMs = Date.now() - startTime;

        try {
          const stats = fs.statSync(outputPath!);
          const duration = await getAudioDuration(outputPath!);

          const result: ConversionResult = {
            outputPath: outputPath!,
            durationSeconds: duration,
            fileSizeBytes: stats.size,
            conversionTimeMs,
          };

          console.log(
            `[FFmpeg] conversion completed in ${conversionTimeMs}ms: ${inputPath} → ${outputPath}`
          );
          if (deleteSource) {
            await unlinkAsync(inputPath);
            console.log(`[FFmpeg] deleted source file: ${inputPath}`);
          }

          resolve(result);
        } catch (error) {
          reject(new Error(`Failed to read output file stats: ${error}`));
        }
      })
      .on("error", (error) => {
        console.error(`[FFmpeg] conversion error: ${error.message}`);
        reject(new Error(`FFmpeg conversion failed: ${error.message}`));
      })
      .save(outputPath);
  });
}

/**
 * Get audio duration using ffprobe
 * @param filePath - Path to audio file
 * @returns Duration in seconds
 */
function getAudioDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (error, metadata) => {
      if (error) {
        reject(error);
      } else {
        const duration = metadata.format.duration || 0;
        resolve(duration);
      }
    });
  });
}

/**
 * Convert WebM to WAV and stream output to buffer
 * Useful for direct API transmission without disk write
 *
 * @param inputPath - Path to input WebM file
 * @param options - Conversion options
 * @returns Promise with audio buffer
 *
 * @example
 * ```typescript
 * const audioBuffer = await convertToWavBuffer('./chunk.webm');
 * const transcript = await gemini.transcribeAudio(audioBuffer);
 * ```
 */
export async function convertToWavBuffer(
  inputPath: string,
  options: ConversionOptions = {}
): Promise<Buffer> {
  const { sampleRate = 16000, channels = 1, applyFilters = false } = options;

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    let command = ffmpeg(inputPath)
      .audioFrequency(sampleRate)
      .audioChannels(channels)
      .audioCodec("pcm_s16le")
      .format("wav");

    if (applyFilters) {
      command = command.audioFilters(["highpass=f=200", "lowpass=f=3000", "volume=1.5"]);
    }

    const stream = command.pipe();

    stream.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    stream.on("end", () => {
      const buffer = Buffer.concat(chunks);
      console.log(`[FFmpeg] Converted to buffer: ${buffer.length} bytes`);
      resolve(buffer);
    });

    stream.on("error", (error: Error) => {
      console.error(`[FFmpeg] Stream error: ${error.message}`);
      reject(error);
    });
  });
}

/**
 * Batch convert multiple WebM files to WAV
 * Processes files in parallel with configurable concurrency
 *
 * @param inputPaths - Array of input file paths
 * @param options - Conversion options
 * @param concurrency - Maximum parallel conversions (default: 3)
 * @returns Promise with array of conversion results
 *
 * @example
 * ```typescript
 * const files = ['chunk_0.webm', 'chunk_1.webm', 'chunk_2.webm'];
 * const results = await batchConvertToWav(files, {}, 3);
 * ```
 */
export async function batchConvertToWav(
  inputPaths: string[],
  options: ConversionOptions = {},
  concurrency: number = 3
): Promise<ConversionResult[]> {
  const results: ConversionResult[] = [];
  const queue = [...inputPaths];

  console.log(
    `[FFmpeg] Starting batch conversion: ${inputPaths.length} files, concurrency: ${concurrency}`
  );

  while (queue.length > 0) {
    const batch = queue.splice(0, concurrency);
    const batchResults = await Promise.all(
      batch.map((inputPath) => convertToWav(inputPath, undefined, options))
    );
    results.push(...batchResults);
  }

  console.log(`[FFmpeg] Batch conversion completed: ${results.length} files`);

  return results;
}

/**
 * Check if FFmpeg is installed and available
 * @returns Promise resolving to true if FFmpeg is available
 */
export async function checkFFmpegAvailability(): Promise<boolean> {
  return new Promise((resolve) => {
    ffmpeg.getAvailableFormats((error) => {
      if (error) {
        console.error("[FFmpeg] Not available:", error.message);
        resolve(false);
      } else {
        console.log("[FFmpeg] Available and ready");
        resolve(true);
      }
    });
  });
}

/**
 * Get audio file metadata
 * @param filePath - Path to audio file
 * @returns Promise with metadata
 */
export async function getAudioMetadata(filePath: string): Promise<{
  duration: number;
  sampleRate: number;
  channels: number;
  codec: string;
  bitrate: number;
}> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (error, metadata) => {
      if (error) {
        reject(error);
      } else {
        const audioStream = metadata.streams.find((stream) => stream.codec_type === "audio");

        if (!audioStream) {
          reject(new Error("No audio stream found"));
          return;
        }

        resolve({
          duration: metadata.format.duration || 0,
          sampleRate: audioStream.sample_rate || 0,
          channels: audioStream.channels || 0,
          codec: audioStream.codec_name || "unknown",
          bitrate: metadata.format.bit_rate || 0,
        });
      }
    });
  });
}
