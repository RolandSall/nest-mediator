import { ICommand } from '@rolandsall24/nest-mediator';

export class CreateUserCommand implements ICommand {
  constructor(
    public readonly name: string,
    public readonly email: string,
  ) {}
}
