import { Controller, Get, Query } from '@nestjs/common';
import { TopologyRepository } from '../database/repositories/topology.repository';

@Controller('api/topology')
export class TopologyController {
  constructor(private readonly topologyRepo: TopologyRepository) {}

  @Get()
  async getTopology(@Query('service') service?: string) {
    return this.topologyRepo.getTopology(service);
  }
}
