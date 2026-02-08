export class CreateOrderApiRequest {
  customerId: string;
  items: { productId: string; quantity: number }[];
  total: number;
}

export class CancelOrderApiRequest {
  reason: string;
}
