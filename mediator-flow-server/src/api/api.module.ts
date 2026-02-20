import { Module } from '@nestjs/common';
import { TopologyController } from './topology.controller';
import { TracesController } from './traces.controller';
import { AggregatesController } from './aggregates.controller';
import { StatsController } from './stats.controller';
import { SearchController } from './search.controller';
import { DiagramsController } from './diagrams.controller';
import { GenerateController } from './generate.controller';
import { AiProxyController } from './ai/ai-proxy.controller';
import { DiagramEngine } from './diagram.engine';
import { DiagramValidator } from './validation';

@Module({
  controllers: [
    TopologyController,
    TracesController,
    AggregatesController,
    StatsController,
    SearchController,
    DiagramsController,
    GenerateController,
    AiProxyController,
  ],
  providers: [DiagramEngine, DiagramValidator],
})
export class ApiModule {}
