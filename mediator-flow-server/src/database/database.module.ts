import { Module, Global, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from './constants';
import { TopologyRepository } from './repositories/topology.repository';
import { StepsRepository } from './repositories/steps.repository';
import { TracesRepository } from './repositories/traces.repository';
import { DiagramsRepository } from './repositories/diagrams.repository';

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      useFactory: async () => {
        const logger = new Logger('DatabaseModule');
        const pool = new Pool({
          connectionString:
            process.env.DATABASE_URL ??
            'postgres://mediatorflow:mediatorflow@localhost:5433/mediatorflow',
          max: 10,
        });
        const client = await pool.connect();
        client.release();
        logger.log('PostgreSQL connected');
        return pool;
      },
    },
    TopologyRepository,
    StepsRepository,
    TracesRepository,
    DiagramsRepository,
  ],
  exports: [PG_POOL, TopologyRepository, StepsRepository, TracesRepository, DiagramsRepository],
})
export class DatabaseModule {}
