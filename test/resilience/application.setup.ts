import 'reflect-metadata';

import {
  Inject,
  Injectable,
  Module,
  type INestApplicationContext,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { installVitestApplicationIntegrationTestSupport } from '@integration-testing/testcontainers/vitest';
import { Pool } from 'pg';
import {
  AggregateRepository,
  AggregateRoot,
  Critical,
  DomainEvent,
  EventHandler,
  EVENT_STORE_REPOSITORY,
  ForAggregate,
  getPostgresSchema,
  type ICriticalEventConsumer,
  type IEvent,
  type IEventConsumer,
  type IEventStoreRepository,
  MediatorBus,
  NestMediatorModule,
} from '../../src/index.js';

const EVENT_TABLE = 'resilience_domain_events';
const BUSINESS_TABLE = 'resilience_business_operations';
const SOURCE_EVENT_TABLE = 'resilience_source_events';
const LEGACY_SOURCE_EVENT_TABLE = 'resilience_legacy_source_events';

export class ResilienceEvent implements IEvent {
  constructor(
    public readonly operationId: string,
    public readonly occurredAt: Date = new Date(),
  ) {}
}

export class ResilienceCompensatedEvent implements IEvent {
  constructor(
    public readonly operationId: string,
    public readonly occurredAt: Date = new Date(),
  ) {}
}

export class BestEffortEvent implements IEvent {
  constructor(public readonly operationId: string) {}
}

@Injectable()
class ConsumerProbe {
  firstCriticalCalls = 0;
  failingCriticalCalls = 0;
  finalCriticalCalls = 0;
  compensationCalls = 0;
  bestEffortCalls = 0;
  failCritical = false;

  reset(): void {
    this.firstCriticalCalls = 0;
    this.failingCriticalCalls = 0;
    this.finalCriticalCalls = 0;
    this.compensationCalls = 0;
    this.bestEffortCalls = 0;
    this.failCritical = false;
  }
}

@Injectable()
@EventHandler(ResilienceEvent)
@Critical({ order: 1 })
class FirstCriticalConsumer
  implements ICriticalEventConsumer<ResilienceEvent>
{
  constructor(private readonly probe: ConsumerProbe) {}

  async handle(): Promise<void> {
    this.probe.firstCriticalCalls++;
  }

  async applyCompensatingEvent(
    event: ResilienceEvent,
  ): Promise<ResilienceCompensatedEvent> {
    return new ResilienceCompensatedEvent(event.operationId);
  }
}

@Injectable()
@EventHandler(ResilienceEvent)
@Critical({ order: 2 })
class FailingCriticalConsumer implements IEventConsumer<ResilienceEvent> {
  constructor(private readonly probe: ConsumerProbe) {}

  async handle(): Promise<void> {
    this.probe.failingCriticalCalls++;
    if (this.probe.failCritical) {
      throw new Error('critical consumer failed');
    }
  }
}

@Injectable()
@EventHandler(ResilienceEvent)
@Critical({ order: 3 })
class FinalCriticalConsumer implements IEventConsumer<ResilienceEvent> {
  constructor(private readonly probe: ConsumerProbe) {}

  async handle(): Promise<void> {
    this.probe.finalCriticalCalls++;
  }
}

@Injectable()
@EventHandler(ResilienceCompensatedEvent)
@Critical()
class CompensationConsumer
  implements IEventConsumer<ResilienceCompensatedEvent>
{
  constructor(private readonly probe: ConsumerProbe) {}

  async handle(): Promise<void> {
    this.probe.compensationCalls++;
  }
}

@Injectable()
@EventHandler(BestEffortEvent)
class FailingBestEffortConsumer implements IEventConsumer<BestEffortEvent> {
  constructor(private readonly probe: ConsumerProbe) {}

  async handle(): Promise<void> {
    this.probe.bestEffortCalls++;
    throw new Error('best-effort consumer failed');
  }
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL must be provided by the integration-test lifecycle');
}

@Module({
  imports: [
    NestMediatorModule.forRoot({
      eventStore: {
        type: 'postgres',
        url: databaseUrl,
        mode: 'audit',
        tableName: EVENT_TABLE,
      },
    }),
  ],
  providers: [
    ConsumerProbe,
    FirstCriticalConsumer,
    FailingCriticalConsumer,
    FinalCriticalConsumer,
    CompensationConsumer,
    FailingBestEffortConsumer,
  ],
})
class ResilienceTestModule {}

@DomainEvent('ResilienceOrder', 'orderId')
export class SourceOrderCreatedEvent implements IEvent {
  constructor(
    public readonly orderId: string,
    public readonly occurredAt: Date = new Date(),
  ) {}
}

@DomainEvent('ResilienceOrder', 'orderId')
export class SourceOrderConfirmedEvent implements IEvent {
  constructor(
    public readonly orderId: string,
    public readonly occurredAt: Date = new Date(),
  ) {}
}

export class SourceOrder extends AggregateRoot<string> {
  private orderId!: string;
  readonly aggregateType = 'ResilienceOrder';

  get id(): string {
    return this.orderId;
  }

  static create(orderId: string): SourceOrder {
    const order = new SourceOrder();
    order.apply(new SourceOrderCreatedEvent(orderId));
    order.apply(new SourceOrderConfirmedEvent(orderId));
    return order;
  }

  applySourceOrderCreatedEvent(event: SourceOrderCreatedEvent): void {
    this.orderId = event.orderId;
  }

  applySourceOrderConfirmedEvent(): void {}
}

@Injectable()
@ForAggregate(SourceOrder)
class SourceOrderRepository extends AggregateRepository<SourceOrder, string> {}

@Injectable()
class SourceConsumerProbe {
  observedStreamLengths: number[] = [];
  fail = false;

  reset(): void {
    this.observedStreamLengths = [];
    this.fail = false;
  }
}

abstract class SourceConsumerBase {
  constructor(
    @Inject(EVENT_STORE_REPOSITORY)
    private readonly eventStore: IEventStoreRepository,
    private readonly probe: SourceConsumerProbe,
  ) {}

  async observe(orderId: string): Promise<void> {
    const storedEvents = await this.eventStore.getEventsForAggregate(
      'ResilienceOrder',
      orderId,
    );
    this.probe.observedStreamLengths.push(storedEvents.length);
    if (this.probe.fail) {
      throw new Error('source consumer failed');
    }
  }
}

@Injectable()
@EventHandler(SourceOrderCreatedEvent)
@Critical({ order: 1 })
class SourceOrderCreatedConsumer
  extends SourceConsumerBase
  implements IEventConsumer<SourceOrderCreatedEvent>
{
  async handle(event: SourceOrderCreatedEvent): Promise<void> {
    await this.observe(event.orderId);
  }
}

@Injectable()
@EventHandler(SourceOrderConfirmedEvent)
@Critical({ order: 1 })
class SourceOrderConfirmedConsumer
  extends SourceConsumerBase
  implements IEventConsumer<SourceOrderConfirmedEvent>
{
  async handle(event: SourceOrderConfirmedEvent): Promise<void> {
    await this.observe(event.orderId);
  }
}

const sourceProviders = [
  SourceOrderRepository,
  SourceConsumerProbe,
  SourceOrderCreatedConsumer,
  SourceOrderConfirmedConsumer,
];

@Module({
  imports: [
    NestMediatorModule.forRoot({
      eventStore: {
        type: 'postgres',
        url: databaseUrl,
        mode: 'source',
        tableName: SOURCE_EVENT_TABLE,
        atomicAggregateSave: true,
      },
    }),
  ],
  providers: sourceProviders,
})
class AtomicSourceTestModule {}

@Module({
  imports: [
    NestMediatorModule.forRoot({
      eventStore: {
        type: 'postgres',
        url: databaseUrl,
        mode: 'source',
        tableName: LEGACY_SOURCE_EVENT_TABLE,
      },
    }),
  ],
  providers: sourceProviders,
})
class LegacySourceTestModule {}

class ResilienceTestApplication {
  private constructor(
    private readonly context: INestApplicationContext,
    private readonly atomicSourceContext: INestApplicationContext,
    private readonly legacySourceContext: INestApplicationContext,
    private readonly pool: Pool,
    readonly mediator: MediatorBus,
    readonly probe: ConsumerProbe,
    readonly atomicSourceRepository: SourceOrderRepository,
    readonly atomicSourceProbe: SourceConsumerProbe,
    readonly legacySourceRepository: SourceOrderRepository,
    readonly legacySourceProbe: SourceConsumerProbe,
  ) {}

  static async start(): Promise<ResilienceTestApplication> {
    const context = await NestFactory.createApplicationContext(
      ResilienceTestModule,
      { logger: false },
    );
    const atomicSourceContext = await NestFactory.createApplicationContext(
      AtomicSourceTestModule,
      { logger: false },
    );
    const legacySourceContext = await NestFactory.createApplicationContext(
      LegacySourceTestModule,
      { logger: false },
    );
    const pool = new Pool({ connectionString: databaseUrl });
    await pool.query('SELECT 1');

    return new ResilienceTestApplication(
      context,
      atomicSourceContext,
      legacySourceContext,
      pool,
      context.get(MediatorBus),
      context.get(ConsumerProbe),
      atomicSourceContext.get(SourceOrderRepository),
      atomicSourceContext.get(SourceConsumerProbe),
      legacySourceContext.get(SourceOrderRepository),
      legacySourceContext.get(SourceConsumerProbe),
    );
  }

  async reset(): Promise<void> {
    this.probe.reset();
    this.atomicSourceProbe.reset();
    this.legacySourceProbe.reset();
    await this.restoreEventStore();
    await this.restoreAtomicSourceEventStore();
    await this.pool.query(getPostgresSchema(LEGACY_SOURCE_EVENT_TABLE));
    await this.pool.query(
      `CREATE TABLE IF NOT EXISTS ${BUSINESS_TABLE} (
        operation_id UUID PRIMARY KEY
      )`,
    );
    await this.pool.query(`TRUNCATE TABLE ${EVENT_TABLE}`);
    await this.pool.query(`TRUNCATE TABLE ${SOURCE_EVENT_TABLE}`);
    await this.pool.query(`TRUNCATE TABLE ${LEGACY_SOURCE_EVENT_TABLE}`);
    await this.pool.query(`TRUNCATE TABLE ${BUSINESS_TABLE}`);
  }

  async runBusinessTransactionThatFails(operationId: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO ${BUSINESS_TABLE} (operation_id) VALUES ($1)`,
        [operationId],
      );
      await this.mediator.publish(new ResilienceEvent(operationId));
      throw new Error('forced business transaction failure');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async businessOperationExists(operationId: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1 FROM ${BUSINESS_TABLE} WHERE operation_id = $1`,
      [operationId],
    );
    return result.rowCount === 1;
  }

  async removeEventStore(): Promise<void> {
    await this.pool.query(`DROP TABLE ${EVENT_TABLE}`);
  }

  async restoreEventStore(): Promise<void> {
    await this.pool.query(getPostgresSchema(EVENT_TABLE));
  }

  async removeAtomicSourceEventStore(): Promise<void> {
    await this.pool.query(`DROP TABLE ${SOURCE_EVENT_TABLE}`);
  }

  async restoreAtomicSourceEventStore(): Promise<void> {
    await this.pool.query(getPostgresSchema(SOURCE_EVENT_TABLE));
  }

  async storedSourceEventTypes(
    tableName: typeof SOURCE_EVENT_TABLE | typeof LEGACY_SOURCE_EVENT_TABLE,
    orderId: string,
  ): Promise<string[]> {
    const result = await this.pool.query<{ event_type: string }>(
      `SELECT event_type
         FROM ${tableName}
        WHERE aggregate_type = 'ResilienceOrder' AND aggregate_id = $1
        ORDER BY sequence_number ASC`,
      [orderId],
    );
    return result.rows.map((row) => row.event_type);
  }

  async atomicSourceEventContext(orderId: string): Promise<
    {
      correlationId: string;
      causationId: string | null;
    }[]
  > {
    const result = await this.pool.query<{
      correlation_id: string;
      causation_id: string | null;
    }>(
      `SELECT correlation_id, causation_id
         FROM ${SOURCE_EVENT_TABLE}
        WHERE aggregate_type = 'ResilienceOrder' AND aggregate_id = $1
        ORDER BY sequence_number ASC`,
      [orderId],
    );

    return result.rows.map(({ correlation_id, causation_id }) => ({
      correlationId: correlation_id,
      causationId: causation_id,
    }));
  }

  atomicSourceEventTypes(orderId: string): Promise<string[]> {
    return this.storedSourceEventTypes(SOURCE_EVENT_TABLE, orderId);
  }

  legacySourceEventTypes(orderId: string): Promise<string[]> {
    return this.storedSourceEventTypes(LEGACY_SOURCE_EVENT_TABLE, orderId);
  }

  async storedEventTypes(operationId: string): Promise<string[]> {
    const result = await this.pool.query<{ event_type: string }>(
      `SELECT event_type
         FROM ${EVENT_TABLE}
        WHERE payload ->> 'operationId' = $1
        ORDER BY event_type ASC`,
      [operationId],
    );
    return result.rows.map((row) => row.event_type);
  }

  async close(): Promise<void> {
    await this.context.close();
    await this.atomicSourceContext.close();
    await this.legacySourceContext.close();
    await this.pool.end();
  }
}

export const applicationContext =
  installVitestApplicationIntegrationTestSupport({
    start: () => ResilienceTestApplication.start(),
    stop: (application) => application.close(),
  });
