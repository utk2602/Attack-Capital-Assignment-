
interface Job<T> {
  id: string;
  data: T;
  attempts: number;
  maxAttempts: number;
  backoffMs: number;
  createdAt: Date;
  processedAt?: Date;
  error?: string;
}

interface JobHandler<T> {
  (job: Job<T>): Promise<void>;
}

interface QueueOptions {
  concurrency?: number;
  maxAttempts?: number;
  backoffMs?: number;
  exponentialBackoff?: boolean;
}

export class SimpleQueue<T = any> {
  private queue: Job<T>[] = [];
  private processing = new Set<string>();
  private handlers: JobHandler<T>[] = [];
  private options: Required<QueueOptions>;
  private failedJobs: Job<T>[] = [];
  private completedJobs: Job<T>[] = [];

  constructor(options: QueueOptions = {}) {
    this.options = {
      concurrency: options.concurrency ?? 3,
      maxAttempts: options.maxAttempts ?? 3,
      backoffMs: options.backoffMs ?? 1000,
      exponentialBackoff: options.exponentialBackoff ?? true,
    };
  }


  process(handler: JobHandler<T>): void {
    this.handlers.push(handler);
    this.processQueue();
  }

  async add(data: T, options?: Partial<QueueOptions>): Promise<string> {
    const job: Job<T> = {
      id: this.generateId(),
      data,
      attempts: 0,
      maxAttempts: options?.maxAttempts ?? this.options.maxAttempts,
      backoffMs: options?.backoffMs ?? this.options.backoffMs,
      createdAt: new Date(),
    };

    this.queue.push(job);
    console.log(`[Queue] Job added: ${job.id}, queue size: ${this.queue.length}`);

    this.processQueue();

    return job.id;
  }

  
  private async processQueue(): Promise<void> {
    if (this.handlers.length === 0) {
      return;
    }

    while (this.queue.length > 0 && this.processing.size < this.options.concurrency) {
      const job = this.queue.shift();
      if (!job) break;

      this.processing.add(job.id);
      this.processJob(job).finally(() => {
        this.processing.delete(job.id);
        this.processQueue(); 
      });
    }
  }

  private async processJob(job: Job<T>): Promise<void> {
    job.attempts++;

    console.log(`[Queue] Processing job: ${job.id}, attempt ${job.attempts}/${job.maxAttempts}`);

    try {
      for (const handler of this.handlers) {
        await handler(job);
      }

      job.processedAt = new Date();
      this.completedJobs.push(job);

      console.log(
        `[Queue] Job completed: ${job.id}, time: ${
          job.processedAt.getTime() - job.createdAt.getTime()
        }ms`
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      job.error = errorMessage;

      console.error(
        `[Queue] Job failed: ${job.id}, attempt ${job.attempts}/${job.maxAttempts}`,
        errorMessage
      );

      if (job.attempts < job.maxAttempts) {
        const delay = this.calculateBackoff(job);
        console.log(`[Queue] Retrying job ${job.id} in ${delay}ms`);

        await this.sleep(delay);
        this.queue.push(job); 
      } else {
        console.error(`[Queue] Job permanently failed after ${job.attempts} attempts: ${job.id}`);
        this.failedJobs.push(job);
      }
    }
  }

  private calculateBackoff(job: Job<T>): number {
    if (this.options.exponentialBackoff) {
      return Math.min(
        job.backoffMs * Math.pow(2, job.attempts - 1),
        30000 
      );
    }
    return job.backoffMs;
  }

  getStats() {
    return {
      queued: this.queue.length,
      processing: this.processing.size,
      completed: this.completedJobs.length,
      failed: this.failedJobs.length,
      concurrency: this.options.concurrency,
    };
  }


  getFailedJobs(): Job<T>[] {
    return [...this.failedJobs];
  }


  retryFailedJobs(): void {
    const failed = this.failedJobs.splice(0);
    for (const job of failed) {
      job.attempts = 0;
      job.error = undefined;
      this.queue.push(job);
    }
    this.processQueue();
  }


  clearCompleted(): void {
    this.completedJobs = [];
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }


  private generateId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const transcriptionQueue = new SimpleQueue<{
  chunkId: string;
  sessionId: string;
  sequence: number;
}>({
  concurrency: 3,
  maxAttempts: 3,
  backoffMs: 1000,
  exponentialBackoff: true,
});
