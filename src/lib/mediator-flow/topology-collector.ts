import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { CommandBus } from '../services/command.bus.js';
import { QueryBus } from '../services/query.bus.js';
import { EventBus } from '../services/event.bus.js';
import { PipelineOrchestrator } from '../services/pipeline.orchestrator.js';
import { StepEmitter } from './step-emitter.js';
import { TopologyExport } from './protocol.js';

const INITIAL_RETRY_MS = 5_000;
const MAX_RETRY_MS = 60_000;

@Injectable()
export class TopologyCollector implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('TopologyCollector');
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly eventBus: EventBus,
    private readonly pipelineOrchestrator: PipelineOrchestrator,
    private readonly stepEmitter: StepEmitter,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.stepEmitter.enabled) return;

    const topology = this.buildTopology();
    void this.sendWithRetry(topology, INITIAL_RETRY_MS);
  }

  onModuleDestroy(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  private async sendWithRetry(topology: TopologyExport, delayMs: number): Promise<void> {
    try {
      await this.sendTopology(topology);
      this.logger.log(
        `Topology sent to collector (${topology.commands.length} commands, ${topology.queries.length} queries, ${topology.events.length} events, ${topology.behaviors.length} behaviors)`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to send topology to ${this.stepEmitter.getCollectorUrl()}: ${(err as Error).message}. Retrying in ${delayMs / 1000}s...`,
      );
      const nextDelay = Math.min(delayMs * 2, MAX_RETRY_MS);
      this.retryTimer = setTimeout(() => this.sendWithRetry(topology, nextDelay), delayMs);
    }
  }

  private buildTopology(): TopologyExport {
    const commands = this.commandBus.getRegisteredCommandsDetailed();
    const queries = this.queryBus.getRegisteredQueriesDetailed();
    const behaviors = this.pipelineOrchestrator.getRegisteredBehaviorsDetailed();
    const eventsDetailed = this.eventBus.getRegisteredEventsDetailed();

    const events = eventsDetailed.map((e) => ({
      eventName: e.eventName,
      consumers: e.consumers.map((c) => ({
        consumerName: c.consumerName,
        criticality: c.criticality,
        order: c.order,
        hasCompensation: c.hasCompensation,
      })),
    }));

    return {
      serviceName: this.stepEmitter.getServiceName(),
      instanceId: this.stepEmitter.getInstanceId(),
      bootedAt: new Date().toISOString(),
      libraryVersion: '1.0.0',
      commands,
      queries,
      events,
      behaviors,
      aggregates: [],
    };
  }

  private async sendTopology(topology: TopologyExport): Promise<void> {
    const url = `${this.stepEmitter.getCollectorUrl()}/collect/topology`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(topology),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
    } finally {
      clearTimeout(timeout);
    }
  }
}
