import { ICommand } from '@rolandsall24/nest-mediator';

/**
 * Command to delete a user.
 * This command requires admin role (enforced by AuthorizationBehavior).
 */
export class DeleteUserCommand implements ICommand {
  constructor(public readonly userId: string) {}
}
