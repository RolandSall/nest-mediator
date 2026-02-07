export class OrderApiResponse {
  orderId: string;
  customerId: string;
  items: { productId: string; quantity: number }[];
  total: number;
  status: string;
  createdAt: Date;
  cancelledAt?: Date;
  cancelReason?: string;
}

export class OrderActionResponse {
  success: boolean;
  message: string;
}
