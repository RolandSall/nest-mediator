import { Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@rolandsall24/nest-mediator';
import { CreateUserCommand } from './create-user.command';

interface User {
  id: string;
  name: string;
  email: string;
}

@Injectable()
@CommandHandler(CreateUserCommand)
export class CreateUserHandler implements ICommandHandler<CreateUserCommand> {
  // In-memory storage for demo
  private static users: User[] = [];

  async execute(command: CreateUserCommand): Promise<void> {
    const user: User = {
      id: Math.random().toString(36).substring(7),
      name: command.name,
      email: command.email,
    };

    CreateUserHandler.users.push(user);
    console.log(`User created: ${JSON.stringify(user)}`);
  }

  // Helper to access users from query handler
  static getUsers(): User[] {
    return CreateUserHandler.users;
  }
}
