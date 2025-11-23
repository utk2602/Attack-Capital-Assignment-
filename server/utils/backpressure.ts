export class BackpressureManager {
  private queueSize = 0;
  private maxQueueSize: number;
  private memoryThreshold: number;
  private maxSocketBuffer: number;
  private lastCheck: number = Date.now();

  constructor(options?: {
    maxQueueSize?: number;
    memoryThreshold?: number;
    maxSocketBuffer?: number;
  }) {
    this.maxQueueSize = options?.maxQueueSize || 10;
    this.memoryThreshold = options?.memoryThreshold || 0.98; // 98% - high threshold for development
    this.maxSocketBuffer = options?.maxSocketBuffer || 5 * 1024 * 1024; // 5 MB
  }

  canAccept(): boolean {
    const queueOk = this.queueSize < this.maxQueueSize;
    const memoryOk = this.getMemoryUsage() < this.memoryThreshold;

    if (!queueOk || !memoryOk) {
      const now = Date.now();
      if (now - this.lastCheck > 5000) {
        console.warn("[Backpressure] Active", {
          queueSize: this.queueSize,
          maxQueue: this.maxQueueSize,
          memoryUsage: (this.getMemoryUsage() * 100).toFixed(2) + "%",
          threshold: (this.memoryThreshold * 100).toFixed(2) + "%",
        });
        this.lastCheck = now;
      }
    }

    return queueOk && memoryOk;
  }

  incrementQueue(): void {
    this.queueSize++;
  }

  decrementQueue(): void {
    this.queueSize = Math.max(0, this.queueSize - 1);
  }

  getQueueSize(): number {
    return this.queueSize;
  }

  private getMemoryUsage(): number {
    const usage = process.memoryUsage();
    return usage.heapUsed / usage.heapTotal;
  }

  getMetrics(): {
    queueSize: number;
    maxQueue: number;
    memoryUsagePct: number;
    canAccept: boolean;
  } {
    return {
      queueSize: this.queueSize,
      maxQueue: this.maxQueueSize,
      memoryUsagePct: this.getMemoryUsage() * 100,
      canAccept: this.canAccept(),
    };
  }

  reset(): void {
    this.queueSize = 0;
    this.lastCheck = Date.now();
  }
}

const managerMap = new Map<string, BackpressureManager>();

export function getBackpressureManager(socketId: string): BackpressureManager {
  if (!managerMap.has(socketId)) {
    managerMap.set(socketId, new BackpressureManager());
  }
  return managerMap.get(socketId)!;
}

export function removeBackpressureManager(socketId: string): void {
  managerMap.delete(socketId);
}
