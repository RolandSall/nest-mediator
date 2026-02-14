import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { StepsRepository } from '../database/repositories/steps.repository';
import { TopologyRepository } from '../database/repositories/topology.repository';

@Injectable()
export class RetentionService {
  private readonly logger = new Logger('RetentionService');
  private readonly retentionDays = parseInt(process.env.RETENTION_DAYS ?? '7', 10);
  private readonly topologyRetentionDays = parseInt(process.env.TOPOLOGY_RETENTION_DAYS ?? '30', 10);

  constructor(
    private readonly stepsRepo: StepsRepository,
    private readonly topologyRepo: TopologyRepository,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async cleanup() {
    const deletedSteps = await this.stepsRepo.deleteOlderThan(this.retentionDays);
    if (deletedSteps > 0) {
      this.logger.log(`Retention: deleted ${deletedSteps} steps older than ${this.retentionDays} days`);
    }

    const deletedServices = await this.topologyRepo.deleteStaleTopology(this.topologyRetentionDays);
    if (deletedServices > 0) {
      this.logger.log(`Retention: removed topology for ${deletedServices} stale services (not seen in ${this.topologyRetentionDays} days)`);
    }
  }
}
