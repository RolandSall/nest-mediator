import { beforeEach, expect, test } from 'vitest';
import { mediatorContext } from '../../src/index.js';
import { applicationContext, SourceOrder } from './application.setup.js';

beforeEach(async () => {
  await applicationContext.current().reset();
});

test('atomically appends every event before dispatching source consumers when enabled', async () => {
  const application = applicationContext.current();
  const order = SourceOrder.create(crypto.randomUUID());

  await application.atomicSourceRepository.save(order);

  await expect(application.atomicSourceEventTypes(order.id)).resolves.toEqual([
    'SourceOrderCreatedEvent',
    'SourceOrderConfirmedEvent',
  ]);
  expect(application.atomicSourceProbe.observedStreamLengths).toEqual([2, 2]);
  expect(order.getUncommittedEvents()).toEqual([]);
});

test('creates one correlation context for a direct atomic aggregate save', async () => {
  const application = applicationContext.current();
  const order = SourceOrder.create(crypto.randomUUID());

  await application.atomicSourceRepository.save(order);

  const eventContext = await application.atomicSourceEventContext(order.id);
  expect(eventContext).toHaveLength(2);
  expect(
    new Set(eventContext.map(({ correlationId }) => correlationId)).size,
  ).toBe(1);
  expect(
    eventContext.every(({ causationId }) => causationId === null),
  ).toBe(true);
});

test('preserves the existing correlation and causation context', async () => {
  const application = applicationContext.current();
  const order = SourceOrder.create(crypto.randomUUID());
  const parentEventId = crypto.randomUUID();
  let correlationId = '';

  await mediatorContext.runWithNewContext(async () => {
    const context = mediatorContext.getContext();
    correlationId = context.correlationId;
    context.currentEventId = parentEventId;

    await application.atomicSourceRepository.save(order);
  });

  await expect(application.atomicSourceEventContext(order.id)).resolves.toEqual([
    { correlationId, causationId: parentEventId },
    { correlationId, causationId: parentEventId },
  ]);
});

test('does not dispatch or mark events committed when the atomic append fails', async () => {
  const application = applicationContext.current();
  const order = SourceOrder.create(crypto.randomUUID());
  await application.removeAtomicSourceEventStore();

  await expect(
    application.atomicSourceRepository.save(order),
  ).rejects.toThrow(/resilience_source_events/);

  expect(application.atomicSourceProbe.observedStreamLengths).toEqual([]);
  expect(order.getUncommittedEvents()).toHaveLength(2);
});

test('keeps committed events cleared when a post-commit source consumer fails', async () => {
  const application = applicationContext.current();
  const order = SourceOrder.create(crypto.randomUUID());
  application.atomicSourceProbe.fail = true;

  await expect(
    application.atomicSourceRepository.save(order),
  ).rejects.toThrow('source consumer failed');

  await expect(application.atomicSourceEventTypes(order.id)).resolves.toEqual([
    'SourceOrderCreatedEvent',
    'SourceOrderConfirmedEvent',
  ]);
  expect(order.getUncommittedEvents()).toEqual([]);
});

test('preserves per-event persistence ordering when atomic saving is not configured', async () => {
  const application = applicationContext.current();
  const order = SourceOrder.create(crypto.randomUUID());

  await application.legacySourceRepository.save(order);

  expect(application.legacySourceProbe.observedStreamLengths).toEqual([1, 2]);
  await expect(application.legacySourceEventTypes(order.id)).resolves.toEqual([
    'SourceOrderCreatedEvent',
    'SourceOrderConfirmedEvent',
  ]);
});
