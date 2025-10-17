import { DynamicModule, Module, Type, OnModuleInit } from '@nestjs/common';
import { Reflector, DiscoveryService, DiscoveryModule } from '@nestjs/core';
import { MediatorBus } from './services/index.js';
import { COMMAND_HANDLER_METADATA, QUERY_HANDLER_METADATA } from './decorators/index.js';
import { ICommand, ICommandHandler, IQuery, IQueryHandler } from './interfaces/index.js';


@Module({})
export class NestMediatorModule implements OnModuleInit {
  constructor(
      private readonly mediatorBus: MediatorBus,
      private readonly reflector: Reflector,
      private readonly discoveryService: DiscoveryService,
  ) {}

  onModuleInit() {
    const providers = this.discoveryService.getProviders();

    for (const wrapper of providers) {
      if (!wrapper.metatype || !wrapper.instance) {
        continue;
      }

      const isFunction = typeof wrapper.metatype === 'function';
      const isConstructor = isFunction && wrapper.metatype.prototype !== undefined;

      if (!isConstructor) {
        continue;
      }

      const handlerType = wrapper.metatype as Type;

      const commandMetadata = this.reflector.get<Type<ICommand>>(
        COMMAND_HANDLER_METADATA,
        handlerType
      );

      if (commandMetadata) {
        console.log(
            `[NestMediator] Registering command handler: ${handlerType.name} for command: ${commandMetadata.name}`
        );
        this.mediatorBus.registerCommandHandler(
            commandMetadata,
            handlerType as Type<ICommandHandler<any>>
        );
      }

      const queryMetadata = this.reflector.get<Type<IQuery>>(
        QUERY_HANDLER_METADATA,
        handlerType
      );

      if (queryMetadata) {
        console.log(
            `[NestMediator] Registering query handler: ${handlerType.name} for query: ${queryMetadata.name}`
        );
        this.mediatorBus.registerQueryHandler(
            queryMetadata,
            handlerType as Type<IQueryHandler<any, any>>
        );
      }
    }
  }

  /**
   * Register the NestMediator module
   * Handlers are automatically discovered from the application's providers
   * @returns Dynamic module
   */
  static forRoot(): DynamicModule {
    return {
      module: NestMediatorModule,
      imports: [
        DiscoveryModule,
      ],
      providers: [
        MediatorBus,
      ],
      exports: [MediatorBus],
      global: true,
    };
  }
}