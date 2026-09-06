import { beforeEach, expect, test, vi } from 'vitest';
import {
  applicationContext,
  BestEffortEvent,
  ResilienceEvent,
} from './application.setup.js';

beforeEach(async () => {
  await applicationContext.current().reset();
});

test('persists the event before invoking critical consumers', async () => {
  const application = applicationContext.current();
  const operationId = crypto.randomUUID();

  await expect(
    application.mediator.publish(new ResilienceEvent(operationId)),
  ).resolves.toMatchObject({ criticalSucceeded: 3 });

  await expect(application.storedEventTypes(operationId)).resolves.toEqual([
    'ResilienceEvent',
  ]);
  expect(application.probe.firstCriticalCalls).toBe(1);
  expect(application.probe.failingCriticalCalls).toBe(1);
  expect(application.probe.finalCriticalCalls).toBe(1);
});

test('rejects publish and skips user consumers when event persistence fails', async () => {
  const application = applicationContext.current();
  const operationId = crypto.randomUUID();
  await application.removeEventStore();

  await expect(
    application.mediator.publish(new ResilienceEvent(operationId)),
  ).rejects.toThrow(/resilience_domain_events/);

  expect(application.probe.firstCriticalCalls).toBe(0);
  expect(application.probe.failingCriticalCalls).toBe(0);
  expect(application.probe.finalCriticalCalls).toBe(0);

  await application.restoreEventStore();
  await expect(application.storedEventTypes(operationId)).resolves.toEqual([]);
});

test('keeps the persisted event and persists compensation when a later critical consumer fails', async () => {
  const application = applicationContext.current();
  const operationId = crypto.randomUUID();
  application.probe.failCritical = true;

  await expect(
    application.mediator.publish(new ResilienceEvent(operationId)),
  ).rejects.toThrow('critical consumer failed');

  await expect(application.storedEventTypes(operationId)).resolves.toEqual([
    'ResilienceCompensatedEvent',
    'ResilienceEvent',
  ]);
  expect(application.probe.firstCriticalCalls).toBe(1);
  expect(application.probe.failingCriticalCalls).toBe(1);
  expect(application.probe.finalCriticalCalls).toBe(0);
  expect(application.probe.compensationCalls).toBe(1);
});

test('does not reject publish when a non-critical consumer fails', async () => {
  const application = applicationContext.current();
  const operationId = crypto.randomUUID();

  await expect(
    application.mediator.publish(new BestEffortEvent(operationId)),
  ).resolves.toMatchObject({ nonCriticalDispatched: 1 });

  await vi.waitFor(() => {
    expect(application.probe.bestEffortCalls).toBe(1);
  });
  await expect(application.storedEventTypes(operationId)).resolves.toEqual([
    'BestEffortEvent',
  ]);
});
