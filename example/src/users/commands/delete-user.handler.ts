import { Injectable, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@rolandsall24/nest-mediator';
import { DeleteUserCommand } from './delete-user.command';

@Injectable()
@CommandHandler(DeleteUserCommand)
export class DeleteUserHandler implements ICommandHandler<DeleteUserCommand> {
  private readonly logger = new Logger(DeleteUserHandler.name);

  async execute(command: DeleteUserCommand): Promise<void> {
    this.logger.log(`Deleting user: ${command.userId}`);
    // Simulate deletion
    await new Promise((resolve) => setTimeout(resolve, 50));
    this.logger.log(`User ${command.userId} deleted successfully`);
  }
}
