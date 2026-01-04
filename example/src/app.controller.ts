import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { MediatorBus } from '@rolandsall24/nest-mediator';
import { CreateUserCommand } from './users/commands/create-user.command';
import { GetUserQuery } from './users/queries/get-user.query';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly mediatorBus: MediatorBus,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

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
}
