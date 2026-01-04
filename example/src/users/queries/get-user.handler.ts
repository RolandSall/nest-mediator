import { Injectable } from '@nestjs/common';
import { QueryHandler, IQueryHandler } from '@rolandsall24/nest-mediator';
import { GetUserQuery } from './get-user.query';
import { CreateUserHandler } from '../commands/create-user.handler';

interface User {
  id: string;
  name: string;
  email: string;
}

@Injectable()
@QueryHandler(GetUserQuery)
export class GetUserHandler implements IQueryHandler<GetUserQuery, User | null> {
  // Mock user database with some initial data
  private mockUsers: User[] = [
    { id: '1', name: 'John Doe', email: 'john@example.com' },
    { id: '2', name: 'Jane Smith', email: 'jane@example.com' },
  ];

  async execute(query: GetUserQuery): Promise<User | null> {
    // Check both mock users and dynamically created users
    const allUsers = [...this.mockUsers, ...CreateUserHandler.getUsers()];
    const user = allUsers.find((u) => u.id === query.userId);

    console.log(`Query for user ${query.userId}: ${user ? 'Found' : 'Not found'}`);
    return user || null;
  }
}
