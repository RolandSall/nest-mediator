import { Controller, Post, Body } from '@nestjs/common';
import { IngestService } from './ingest.service';

@Controller('collect')
export class IngestController {
  constructor(private readonly ingestService: IngestService) {}

  @Post('topology')
  async ingestTopology(@Body() body: any) {
    await this.ingestService.upsertTopology(body);
    return { ok: true };
  }

  @Post('steps')
  async ingestSteps(@Body() body: any) {
    await this.ingestService.insertSteps(body);
    return { ok: true };
  }
}
