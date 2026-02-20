import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common';
import { DiagramEngine } from './diagram.engine';

@Controller('api/diagrams')
export class DiagramsController {
  constructor(private readonly engine: DiagramEngine) {}

  @Get()
  list() {
    return this.engine.list();
  }

  @Get('import-topology')
  importTopology(@Query('service') service?: string) {
    return this.engine.importTopology(service);
  }

  @Post('validate')
  validate(@Body() body: { nodes: any[]; edges: any[] }) {
    return this.engine.validate(body.nodes ?? [], body.edges ?? []);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.engine.findById(id);
  }

  @Post()
  create(@Body() body: { name: string; description?: string; graph: { nodes: any[]; edges: any[] } }) {
    return this.engine.create(body);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string; graph?: { nodes: any[]; edges: any[] } },
  ) {
    return this.engine.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.engine.remove(id);
  }
}
