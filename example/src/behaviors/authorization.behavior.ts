import {
  Injectable,
  Logger,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { IPipelineBehavior, PipelineBehavior } from '@rolandsall24/nest-mediator';

/**
 * Simple authorization service for demonstration.
 * In production, integrate with your auth system (JWT, session, etc.)
 */
@Injectable()
export class AuthorizationService {
  private readonly logger = new Logger(AuthorizationService.name);

  // Simulated user context - in real app, get from request context
  private currentUser: { id: string; roles: string[] } | null = {
    id: 'user-123',
    roles: ['user'],
  };

  /**
   * Set the current user (for testing different scenarios)
   */
  setUser(user: { id: string; roles: string[] } | null): void {
    this.currentUser = user;
    this.logger.log(
      `User set to: ${user ? `${user.id} with roles [${user.roles.join(', ')}]` : 'null (unauthenticated)'}`,
    );
  }

  getCurrentUser(): { id: string; roles: string[] } | null {
    return this.currentUser;
  }

  /**
   * Check if user has required role
   */
  hasRole(role: string): boolean {
    return this.currentUser?.roles.includes(role) ?? false;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.currentUser !== null;
  }
}

/**
 * Authorization behavior that checks permissions before executing requests.
 *
 * Scope: 'all' - runs for both commands and queries
 * Priority: 25 - runs after logging (0), performance (10), but before audit (50)
 */
@Injectable()
@PipelineBehavior({ priority: 25, scope: 'all' })
export class AuthorizationBehavior<TRequest = any, TResponse = any>
  implements IPipelineBehavior<TRequest, TResponse>
{
  private readonly logger = new Logger(AuthorizationBehavior.name);

  // Define which requests require admin role
  private readonly adminOnlyRequests = ['DeleteUserCommand'];

  constructor(private readonly authService: AuthorizationService) {}

  async handle(
    request: TRequest,
    next: () => Promise<TResponse>,
  ): Promise<TResponse> {
    const requestName = this.getRequestName(request);

    // Check if user is authenticated
    if (!this.authService.isAuthenticated()) {
      this.logger.warn(`[AUTH] Unauthenticated access attempt: ${requestName}`);
      throw new UnauthorizedException('Authentication required');
    }

    // Check if request requires admin role
    if (this.adminOnlyRequests.includes(requestName)) {
      if (!this.authService.hasRole('admin')) {
        this.logger.warn(
          `[AUTH] Forbidden: ${requestName} requires admin role`,
        );
        throw new ForbiddenException('Admin role required');
      }
    }

    const user = this.authService.getCurrentUser();
    this.logger.log(`[AUTH] Authorized: ${user?.id} executing ${requestName}`);

    return next();
  }

  private getRequestName(request: TRequest): string {
    if (request && typeof request === 'object' && request.constructor) {
      return request.constructor.name;
    }
    return 'UnknownRequest';
  }
}
