# Atomic Source Aggregate Saves

`atomicAggregateSave` makes one aggregate save the persistence boundary in
source mode. Every event currently uncommitted by that aggregate is appended in
one event-store transaction before any user consumer runs.

## Enable the behavior

```typescript
NestMediatorModule.forRoot({
  eventStore: {
    type: 'postgres', // or 'sqlserver'
    url: process.env.DATABASE_URL,
    mode: 'source',
    atomicAggregateSave: true,
  },
});
```

Applications continue to use the aggregate repository normally:

```typescript
const order = await orders.getById(command.orderId);

order.addItem('product-1', 2);
order.addItem('product-2', 1);
order.confirm();

await orders.save(order);
```

At the `save()` call, the aggregate has three uncommitted events:

```text
ItemAdded(product-1)
ItemAdded(product-2)
OrderConfirmed
```

## Persistence happens first

The repository appends the complete batch with one expected-version check:

```text
BEGIN
  verify the expected Order stream version
  append ItemAdded(product-1)
  append ItemAdded(product-2)
  append OrderConfirmed
COMMIT
```

PostgreSQL and SQL Server perform the version check and all inserts inside the
same transaction. A version conflict or failed insert rolls back the complete
batch. No user consumer runs and the aggregate retains the events as
uncommitted so the application can handle the failure explicitly.

## Consumers run after commit

After the batch commits, the aggregate marks all three events committed and
publishes them to user consumers in their original order:

```text
persist all events
mark the aggregate events committed

publish ItemAdded(product-1)
publish ItemAdded(product-2)
publish OrderConfirmed
return from save()
```

This separation is intentional: source events are the authoritative state and
must exist before a consumer reacts to them.

If a critical consumer fails, `save()` rejects and publication stops at that
point. The already-committed source events remain committed and cannot be
rolled back. Later handlers or later events in the batch may therefore not
have run. The aggregate still reports no uncommitted events because the event
store already contains the complete authoritative change.

```text
append three events -> COMMIT
publish event 1     -> succeeds
publish event 2     -> critical consumer fails
publish event 3     -> not reached
save()              -> rejects
```

Applications that require guaranteed post-commit consumer delivery need a
durable subscriber checkpoint or outbox on the consumer side. Critical
consumers should also be idempotent because retrying an application operation
must not duplicate external effects.

## Transaction boundary

The atomic batch contains only events already pending on the single aggregate
passed to `AggregateRepository.save()`.

It does not include:

- events later published by a consumer;
- events belonging to another aggregate;
- audit records;
- message-broker publications or other external effects.

Those operations require their own consistency and delivery boundaries.

## Backward compatibility

The option defaults to `false` throughout the 1.x line. Without it, the
established flow remains:

```text
persist event 1 -> run event 1 consumers
persist event 2 -> run event 2 consumers
persist event 3 -> run event 3 consumers
mark the aggregate events committed
```

Direct `mediator.publish()` also retains its established per-event behavior.
New source-mode applications should enable `atomicAggregateSave` and persist
aggregate changes through `AggregateRepository.save()`.

## Custom repository contract

No new `IEventStoreRepository` method is required. A custom repository used
with this option must implement the existing `appendEvents()` method so that:

1. every supplied event is committed or none is;
2. `expectedVersion` is checked in the same database transaction;
3. the method resolves only after the batch commits;
4. a conflict or persistence error rejects without a partial append.

Consumer dispatch remains the library's responsibility.
