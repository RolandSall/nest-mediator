# Atomic Source Save Example

An application accepts one command to add several items to an existing order:

```typescript
class OrderAggregate extends AggregateRoot<string> {
  addItems(items: Array<{ productId: string; quantity: number }>): void {
    if (items.length === 0) {
      throw new Error('At least one item is required');
    }

    for (const item of items) {
      this.apply(
        new OrderItemAddedEvent(
          this.id,
          item.productId,
          item.quantity,
        ),
      );
    }
  }
}

async execute(command: AddOrderItemsCommand): Promise<void> {
  const order = await this.orderRepository.getById(command.orderId);

  order.addItems(command.items);
  await this.orderRepository.save(order);
}
```

If the command contains two items, the aggregate has two uncommitted events at
the single `save()` boundary:

```text
OrderItemAddedEvent(product-1)
OrderItemAddedEvent(product-2)
```

With `atomicAggregateSave: true`, the repository appends both events in one
aggregate-stream transaction:

```text
BEGIN
check the expected Order version
insert OrderItemAddedEvent(product-1)
insert OrderItemAddedEvent(product-2)
COMMIT
```

If either insert fails, the transaction rolls back and neither item addition is
stored. Only events already pending on this `OrderAggregate` are part of the
transaction. Events later produced by consumers, events from other aggregates,
audit records, and external messages are outside it.
