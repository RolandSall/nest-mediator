import { Controller, Get, Query } from '@nestjs/common';
import { StepsRepository } from '../database/repositories/steps.repository';

@Controller('api/stats')
export class StatsController {
  constructor(private readonly stepsRepo: StepsRepository) {}

  @Get()
  async getStats(
    @Query('service') service?: string,
    @Query('since') since?: string,
  ) {
    return this.stepsRepo.getStats(service, since);
  }
}
