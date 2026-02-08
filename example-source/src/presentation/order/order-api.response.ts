export class OrderApiResponse {
  orderId: string;
  customerId: string;
  items: { productId: string; quantity: number }[];
  total: number;
  status: string;
  cancelReason?: string;
  version: number;
}

export class OrderActionResponse {
  success: boolean;
  message: string;
}
