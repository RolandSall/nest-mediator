import { Module } from '@nestjs/common';
import { TopologyController } from './topology.controller';
import { TracesController } from './traces.controller';
import { AggregatesController } from './aggregates.controller';
import { StatsController } from './stats.controller';
import { SearchController } from './search.controller';

@Module({
  controllers: [
    TopologyController,
    TracesController,
    AggregatesController,
    StatsController,
    SearchController,
  ],
})
export class ApiModule {}
