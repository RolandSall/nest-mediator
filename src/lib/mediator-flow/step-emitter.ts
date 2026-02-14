import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { mediatorContext } from '../context/mediator-context.js';
import {
  ExecutionStep,
  StepType,
  StepBatch,
  MediatorFlowExporterConfig,
} from './protocol.js';

const MAX_BUFFER_SIZE = 1000;

@Injectable()
export class StepEmitter implements OnModuleDestroy {
  private readonly logger = new Logger('StepEmitter');

  enabled = false;
  private collectorUrl = '';
  private serviceName = 'unknown';
  private instanceId = uuidv4();
  private batchSize = 50;
  private flushIntervalMs = 2000;
  private includePayloads = false;
  private httpTimeoutMs = 3000;

  private buffer: ExecutionStep[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  emit(
    type: StepType,
    name: string,
    extra?: Partial<Pick<ExecutionStep, 'eventId' | 'durationMs' | 'error' | 'payload' | 'metadata'>>,
  ): void {
    if (!this.enabled) return;

    const ctx = mediatorContext.getContext();

    const step: ExecutionStep = {
      stepId: uuidv4(),
      instanceId: this.instanceId,
      type,
      timestamp: new Date().toISOString(),
      correlationId: ctx.correlationId,
      causationId: ctx.causationId,
      eventId: extra?.eventId,
      durationMs: extra?.durationMs,
      name,
      error: extra?.error,
      payload: this.includePayloads ? extra?.payload : undefined,
      metadata: extra?.metadata,
    };

    if (this.buffer.length >= MAX_BUFFER_SIZE) {
      this.buffer.shift();
    }
    this.buffer.push(step);

    if (this.buffer.length >= this.batchSize) {
      this.flush();
    }
  }

  async wrapAsync<T>(
    startType: StepType,
    completedType: StepType,
    failedType: StepType,
    name: string,
    fn: () => Promise<T>,
    extra?: Partial<Pick<ExecutionStep, 'eventId' | 'payload' | 'metadata'>>,
  ): Promise<T> {
    if (!this.enabled) return fn();

    this.emit(startType, name, extra);
    const start = Date.now();
    try {
      const result = await fn();
      this.emit(completedType, name, {
        ...extra,
        durationMs: Date.now() - start,
      });
      return result;
    } catch (err) {
      this.emit(failedType, name, {
        ...extra,
        durationMs: Date.now() - start,
        error: (err as Error).message,
      });
      throw err;
    }
  }

  configure(config: MediatorFlowExporterConfig): void {
    this.enabled = config.enabled;
    this.collectorUrl = config.collectorUrl.replace(/\/$/, '');
    this.serviceName = config.serviceName ?? 'unknown';
    this.batchSize = config.batchSize ?? 50;
    this.flushIntervalMs = config.flushIntervalMs ?? 2000;
    this.includePayloads = config.includePayloads ?? false;
    this.httpTimeoutMs = config.httpTimeoutMs ?? 3000;

    if (this.enabled) {
      this.flushTimer = setInterval(() => this.flush(), this.flushIntervalMs);
      this.logger.log(
        `MediatorFlow exporter enabled → ${this.collectorUrl} (batch=${this.batchSize}, flush=${this.flushIntervalMs}ms)`,
      );
    }
  }

  getInstanceId(): string {
    return this.instanceId;
  }

  getServiceName(): string {
    return this.serviceName;
  }

  getCollectorUrl(): string {
    return this.collectorUrl;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.buffer.length > 0) {
      await this.flush();
    }
  }

  private flush(): void {
    if (this.buffer.length === 0) return;

    const steps = this.buffer.splice(0, this.buffer.length);
    const batch: StepBatch = {
      instanceId: this.instanceId,
      serviceName: this.serviceName,
      steps,
    };

    const url = `${this.collectorUrl}/collect/steps`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.httpTimeoutMs);

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
      signal: controller.signal,
    })
      .catch((err: Error) => {
        this.logger.warn(`MediatorFlow flush failed: ${err.message}`);
      })
      .finally(() => {
        clearTimeout(timeout);
      });
  }
}
