import { IEvent } from './event.interface.js';

/**
 * Interface for event consumers.
 * Event consumers subscribe to events and react to them.
 * Multiple consumers can subscribe to the same event.
 *
 * Use this interface for non-critical consumers (fire-and-forget).
 *
 * @example
 * ```typescript
 * @EventHandler(UserCreatedEvent)
 * @NonCritical()
 * export class SendWelcomeEmailConsumer implements IEventConsumer<UserCreatedEvent> {
 *   async handle(event: UserCreatedEvent): Promise<void> {
 *     await this.emailService.sendWelcome(event.userEmail);
 *   }
 * }
 * ```
 */
export interface IEventConsumer<TEvent extends IEvent> {
  /**
   * Handle the event
   * @param event - The event instance
   */
  handle(event: TEvent): Promise<void>;
}

/**
 * Interface for critical event consumers with compensation.
 * Critical consumers run sequentially and can define a compensation method
 * that will be called if a subsequent critical consumer fails.
 *
 * Compensation is called in reverse order (last succeeded -> first succeeded)
 * when a critical consumer in the chain fails.
 *
 * If a handler has nothing to compensate (e.g., read-only operations),
 * simply don't implement any compensation method.
 *
 * ## Compensation Methods
 *
 * **`applyCompensatingEvent()` (Recommended)**
 * Returns a compensating event that the library will automatically publish.
 * This follows proper event sourcing semantics where compensation is represented
 * as new events in the system, not as direct side effects.
 *
 * **`compensate()` (Deprecated)**
 * Performs side effects directly. This approach is deprecated because:
 * - Side effects are not captured in the event store
 * - Harder to trace and debug compensation flows
 * - Doesn't follow event sourcing principles
 *
 * ## Migration Guide
 *
 * To migrate from `compensate()` to `applyCompensatingEvent()`:
 *
 * 1. Create a new compensating event class (e.g., `InventoryReleasedEvent`)
 * 2. Move the compensation logic from `compensate()` into a consumer for that event
 * 3. Replace `compensate()` with `applyCompensatingEvent()` that returns the new event
 *
 * Before (deprecated) - logic in compensate():
 * ```typescript
 * async compensate(event: OrderPlacedEvent): Promise<void> {
 *   // BAD: Side effect directly in compensate, not persisted, not traceable
 *   await this.inventoryService.release(event.orderId, event.items);
 * }
 * ```
 *
 * After (recommended) - logic in dedicated consumer:
 * ```typescript
 * // Step 1: applyCompensatingEvent just returns the event (no side effects!)
 * async applyCompensatingEvent(event: OrderPlacedEvent): Promise<IEvent> {
 *   return new InventoryReleasedEvent(event.orderId, event.items);
 * }
 *
 * // Step 2: Create a consumer for the compensating event (where the logic lives)
 * @EventHandler(InventoryReleasedEvent)
 * export class ReleaseInventoryConsumer implements IEventConsumer<InventoryReleasedEvent> {
 *   async handle(event: InventoryReleasedEvent): Promise<void> {
 *     // GOOD: Logic here, event is persisted, traceable, can have its own consumers
 *     await this.inventoryService.release(event.orderId, event.items);
 *   }
 * }
 * ```
 *
 * @example
 * ```typescript
 * @EventHandler(OrderPlacedEvent)
 * @Critical({ order: 2 })
 * export class ReserveInventoryConsumer implements ICriticalEventConsumer<OrderPlacedEvent> {
 *   async handle(event: OrderPlacedEvent): Promise<void> {
 *     await this.inventoryService.reserve(event.orderId, event.items);
 *   }
 *
 *   async applyCompensatingEvent(event: OrderPlacedEvent): Promise<IEvent> {
 *     return new InventoryReleasedEvent(event.orderId, event.items);
 *   }
 * }
 * ```
 */
export interface ICriticalEventConsumer<TEvent extends IEvent> extends IEventConsumer<TEvent> {
  /**
   * Return a compensating event that the library will publish.
   *
   * This is the recommended approach for compensation. The library will:
   * 1. Call this method when a subsequent critical consumer fails
   * 2. Automatically publish the returned event via `eventBus.publish()`
   * 3. The compensating event goes through the **full event flow**:
   *    - Persisted to event store (audit trail)
   *    - Dispatched to its own consumers (where the actual rollback logic lives)
   *    - Supports its own critical/non-critical consumer chain
   *
   * **Important:** This method should ONLY return the event, not perform side effects.
   * The actual compensation logic (e.g., releasing inventory, refunding payment)
   * should live in a dedicated consumer that handles the compensating event.
   *
   * Benefits over deprecated `compensate()`:
   * - Compensating events are persisted in the event store (full audit trail)
   * - Compensation flows are traceable via correlation/causation IDs
   * - Follows event sourcing semantics (events are facts, not side effects)
   * - Compensation logic lives in dedicated consumers (single responsibility)
   * - Compensating events can have their own consumers (e.g., send notification)
   *
   * @param event - The same event instance passed to handle()
   * @returns The compensating event to publish
   */
  applyCompensatingEvent?(event: TEvent): Promise<IEvent>;

  /**
   * @deprecated Use `applyCompensatingEvent()` instead.
   *
   * This method performs side effects directly, which is deprecated because:
   * - Side effects are not captured in the event store
   * - Compensation flows are not traceable
   * - Violates event sourcing principles
   *
   * Migrate by:
   * 1. Creating a compensating event class
   * 2. Moving this logic into a consumer for that event
   * 3. Implementing `applyCompensatingEvent()` to return the event
   *
   * @param event - The same event instance passed to handle()
   */
  compensate?(event: TEvent): Promise<void>;
}
