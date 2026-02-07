import { DomainException } from './domain.exception';

export class OrderNotFoundException extends DomainException {
  constructor(orderId: string) {
    super(`Order ${orderId} not found`);
    this.name = 'OrderNotFoundException';
  }
}
