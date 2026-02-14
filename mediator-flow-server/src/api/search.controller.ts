import { Controller, Get, Query } from '@nestjs/common';
import { StepsRepository } from '../database/repositories/steps.repository';

@Controller('api/search')
export class SearchController {
  constructor(private readonly stepsRepo: StepsRepository) {}

  @Get()
  async search(
    @Query('q') q: string,
    @Query('type') type?: string,
  ) {
    if (!q) return [];
    const results = await this.stepsRepo.search(q, type);
    return results.map((s: any) => ({
      stepId: s.step_id,
      type: s.step_type,
      name: s.name,
      error: s.error,
      timestamp: s.timestamp,
      correlationId: s.correlation_id,
      serviceName: s.service_name,
    }));
  }
}
