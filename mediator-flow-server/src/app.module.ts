import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './database/database.module';
import { IngestModule } from './ingest/ingest.module';
import { ApiModule } from './api/api.module';
import { RetentionService } from './retention/retention.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    DatabaseModule,
    IngestModule,
    ApiModule,
  ],
  providers: [RetentionService],
})
export class AppModule {}
