import { Injectable, Logger } from '@nestjs/common';
import { TopologyRepository } from '../database/repositories/topology.repository';
import { StepsRepository } from '../database/repositories/steps.repository';

@Injectable()
export class IngestService {
  private readonly logger = new Logger('IngestService');

  constructor(
    private readonly topologyRepo: TopologyRepository,
    private readonly stepsRepo: StepsRepository,
  ) {}

  async upsertTopology(topology: any) {
    const { serviceName, instanceId } = topology;

    await this.topologyRepo.replaceTopology({
      serviceName,
      instanceId,
      bootedAt: topology.bootedAt,
      libraryVersion: topology.libraryVersion,
      commands: topology.commands ?? [],
      queries: topology.queries ?? [],
      events: (topology.events ?? []).map((e: any) => ({
        eventName: e.eventName,
        aggregateType: e.aggregateType,
        consumers: e.consumers ?? [],
      })),
      behaviors: topology.behaviors ?? [],
      aggregates: topology.aggregates ?? [],
    });

    this.logger.log(`Topology replaced for ${serviceName}/${instanceId}`);
  }

  async insertSteps(batch: any) {
    const { serviceName, steps } = batch;
    if (!steps || steps.length === 0) return;

    await this.stepsRepo.bulkInsert(serviceName, steps.map((s: any) => ({
      step_id: s.stepId,
      instance_id: s.instanceId,
      service_name: serviceName,
      step_type: s.type,
      timestamp: s.timestamp,
      correlation_id: s.correlationId,
      causation_id: s.causationId,
      event_id: s.eventId,
      duration_ms: s.durationMs,
      name: s.name,
      error: s.error,
      payload: s.payload,
      metadata: s.metadata,
    })));
  }
}
