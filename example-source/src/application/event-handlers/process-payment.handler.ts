import { Injectable, Logger } from '@nestjs/common';
import { EventHandler, ICriticalEventConsumer, IEvent, MediatorBus, Critical } from '@nest-mediator/core';
import { OrderPlacedEvent, PaymentChargedEvent, PaymentRefundedEvent } from '../../domain/events';
import { ChaosService } from '../chaos/chaos.service';
import { SimulatedFailureError } from '../../domain/exceptions';

@Injectable()
@EventHandler(OrderPlacedEvent)
@Critical({ order: 2 })
export class ProcessPaymentHandler implements ICriticalEventConsumer<OrderPlacedEvent> {
  private readonly logger = new Logger(ProcessPaymentHandler.name);

  constructor(
    private readonly mediatorBus: MediatorBus,
    private readonly chaosService: ChaosService,
  ) {}

  async handle(event: OrderPlacedEvent): Promise<void> {
    if (this.chaosService.shouldFail('payment')) {
      this.logger.error(`[Payment] SIMULATED FAILURE for order ${event.orderId}`);
      throw new SimulatedFailureError('payment');
    }

    this.logger.log(`[Payment] Charged $${event.total} for order ${event.orderId}`);

    await this.mediatorBus.publish(
      new PaymentChargedEvent(event.orderId, event.total),
    );
  }

  async applyCompensatingEvent(event: OrderPlacedEvent): Promise<IEvent> {
    this.logger.warn(`[Payment] Compensating: refunding payment for order ${event.orderId}`);
    return new PaymentRefundedEvent(event.orderId);
  }
}
