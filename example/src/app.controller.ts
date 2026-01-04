import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { MediatorBus } from '@rolandsall24/nest-mediator';
import { CreateUserCommand } from './users/commands/create-user.command';
import { DeleteUserCommand } from './users/commands/delete-user.command';
import { ProcessPaymentCommand } from './users/commands/process-payment.command';
import { GetUserQuery } from './users/queries/get-user.query';
import { AuthorizationService, CachingBehavior } from './behaviors';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly mediatorBus: MediatorBus,
    private readonly authService: AuthorizationService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // =========================================
  // USER ENDPOINTS
  // =========================================

  @Post('users')
  async createUser(@Body() body: { name: string; email: string }) {
    const command = new CreateUserCommand(body.name, body.email);
    await this.mediatorBus.send(command);
    return { message: 'User created successfully' };
  }

  @Get('users/:id')
  async getUser(@Param('id') id: string) {
    const query = new GetUserQuery(id);
    return await this.mediatorBus.query(query);
  }

  /**
   * DELETE /users/:id - Requires admin role
   * Test with: curl -X DELETE http://localhost:3000/users/123
   */
  @Delete('users/:id')
  async deleteUser(@Param('id') id: string) {
    const command = new DeleteUserCommand(id);
    await this.mediatorBus.send(command);
    return { message: `User ${id} deleted successfully` };
  }

  // =========================================
  // PAYMENT ENDPOINTS (for testing retry)
  // =========================================

  /**
   * POST /payments - Process a payment
   * Test with: curl -X POST http://localhost:3000/payments \
   *   -H "Content-Type: application/json" \
   *   -d '{"orderId":"order-1","amount":99.99}'
   */
  @Post('payments')
  async processPayment(
    @Body() body: { orderId: string; amount: number; simulateFailure?: boolean },
  ) {
    const command = new ProcessPaymentCommand(
      body.orderId,
      body.amount,
      body.simulateFailure ?? false,
    );
    await this.mediatorBus.send(command);
    return { message: `Payment of $${body.amount} processed for order ${body.orderId}` };
  }

  /**
   * POST /payments/unreliable - Test retry behavior
   * This endpoint intentionally fails 2 times before succeeding.
   * The RetryBehavior will automatically retry.
   *
   * Test with: curl -X POST http://localhost:3000/payments/unreliable \
   *   -H "Content-Type: application/json" \
   *   -d '{"orderId":"order-retry-test","amount":50.00}'
   */
  @Post('payments/unreliable')
  async processUnreliablePayment(
    @Body() body: { orderId: string; amount: number },
  ) {
    const command = new ProcessPaymentCommand(
      body.orderId,
      body.amount,
      true, // Simulate failure
      2, // Fail 2 times before succeeding
    );
    await this.mediatorBus.send(command);
    return {
      message: `Payment processed after retries for order ${body.orderId}`,
    };
  }

  // =========================================
  // AUTH TESTING ENDPOINTS
  // =========================================

  /**
   * POST /auth/login - Set user role for testing
   * Test with: curl -X POST http://localhost:3000/auth/login \
   *   -H "Content-Type: application/json" \
   *   -d '{"userId":"admin-1","roles":["user","admin"]}'
   */
  @Post('auth/login')
  setUser(@Body() body: { userId: string; roles: string[] }) {
    this.authService.setUser({ id: body.userId, roles: body.roles });
    return {
      message: `Logged in as ${body.userId} with roles: ${body.roles.join(', ')}`,
    };
  }

  /**
   * POST /auth/logout - Clear user (test unauthenticated access)
   * Test with: curl -X POST http://localhost:3000/auth/logout
   */
  @Post('auth/logout')
  clearUser() {
    this.authService.setUser(null);
    return { message: 'Logged out - now unauthenticated' };
  }

  /**
   * GET /auth/me - Get current user
   */
  @Get('auth/me')
  getCurrentUser() {
    const user = this.authService.getCurrentUser();
    return user ?? { message: 'Not authenticated' };
  }

  // =========================================
  // CACHE TESTING ENDPOINTS
  // =========================================

  /**
   * POST /cache/clear - Clear the query cache
   * Test with: curl -X POST http://localhost:3000/cache/clear
   */
  @Post('cache/clear')
  clearCache() {
    CachingBehavior.clearCache();
    return { message: 'Cache cleared' };
  }
}
