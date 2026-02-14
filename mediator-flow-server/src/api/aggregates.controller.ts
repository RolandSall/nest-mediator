import { Controller, Get, Param } from '@nestjs/common';
import { StepsRepository } from '../database/repositories/steps.repository';

@Controller('api/aggregates')
export class AggregatesController {
  constructor(private readonly stepsRepo: StepsRepository) {}

  @Get(':type/:id')
  async getAggregateEvents(
    @Param('type') type: string,
    @Param('id') id: string,
  ) {
    const events = await this.stepsRepo.getAggregateEvents(type, id);
    return {
      aggregateType: type,
      aggregateId: id,
      events: events.map((e: any) => ({
        stepId: e.step_id,
        eventName: e.name,
        timestamp: e.timestamp,
        correlationId: e.correlation_id,
        payload: e.payload,
        metadata: e.metadata,
      })),
    };
  }
}
