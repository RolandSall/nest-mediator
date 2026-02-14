import { Controller, Get, Param, Query } from '@nestjs/common';
import { TracesRepository } from '../database/repositories/traces.repository';
import { StepsRepository } from '../database/repositories/steps.repository';

@Controller('api/traces')
export class TracesController {
  constructor(
    private readonly tracesRepo: TracesRepository,
    private readonly stepsRepo: StepsRepository,
  ) {}

  @Get()
  async getTraces(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('hasErrors') hasErrors?: string,
    @Query('hasCompensations') hasCompensations?: string,
    @Query('service') service?: string,
    @Query('since') since?: string,
    @Query('search') search?: string,
  ) {
    return this.tracesRepo.getTraces({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      hasErrors: hasErrors !== undefined ? hasErrors === 'true' : undefined,
      hasCompensations: hasCompensations !== undefined ? hasCompensations === 'true' : undefined,
      service,
      since,
      search,
    });
  }

  @Get(':correlationId')
  async getTrace(@Param('correlationId') correlationId: string) {
    const steps = await this.stepsRepo.getStepsByCorrelation(correlationId);
    return {
      correlationId,
      steps: steps.map((s: any) => ({
        stepId: s.step_id,
        instanceId: s.instance_id,
        type: s.step_type,
        timestamp: s.timestamp,
        correlationId: s.correlation_id,
        causationId: s.causation_id,
        eventId: s.event_id,
        durationMs: s.duration_ms,
        name: s.name,
        error: s.error,
        payload: s.payload,
        metadata: s.metadata,
      })),
    };
  }
}
