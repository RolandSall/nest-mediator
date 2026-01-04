import { IQuery } from '@rolandsall24/nest-mediator';

export class GetUserQuery implements IQuery {
  constructor(public readonly userId: string) {}
}
