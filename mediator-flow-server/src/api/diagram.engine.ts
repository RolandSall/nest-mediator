import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DiagramsRepository, type DiagramRow } from '../database/repositories/diagrams.repository';
import { TopologyRepository } from '../database/repositories/topology.repository';
import { DiagramValidator } from './validation';
import type { ValidationResult } from './validation';
import { buildFiles, type GenerationResult } from './code-generator/file-builder';

export interface DiagramGraph {
  nodes: any[];
  edges: any[];
}

export interface DiagramDto {
  id: string;
  name: string;
  description: string | null;
  nodes: any[];
  edges: any[];
  createdAt: string;
  updatedAt: string;
}

export interface DiagramSummaryDto {
  id: string;
  name: string;
  description: string | null;
  nodeCount: number;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class DiagramEngine {
  constructor(
    private readonly diagramsRepo: DiagramsRepository,
    private readonly topologyRepo: TopologyRepository,
    private readonly validator: DiagramValidator,
  ) {}

  // ── Queries ──

  async list(): Promise<DiagramSummaryDto[]> {
    const rows = await this.diagramsRepo.findAll();
    return rows.map((r) => this.toSummaryDto(r));
  }

  async findById(id: string): Promise<DiagramDto> {
    const row = await this.diagramsRepo.findById(id);
    if (!row) throw new NotFoundException('Diagram not found');
    return this.toDto(row);
  }

  // ── Mutations (with validation) ──

  async create(data: {
    name: string;
    description?: string;
    graph: DiagramGraph;
  }): Promise<DiagramDto> {
    this.validateOnSave(data.name, data.graph);
    const row = await this.diagramsRepo.create(data);
    return this.toDto(row);
  }

  async update(
    id: string,
    data: { name?: string; description?: string; graph?: DiagramGraph },
  ): Promise<DiagramDto> {
    if (data.graph) {
      this.validateOnSave(data.name, data.graph);
    }
    const row = await this.diagramsRepo.update(id, data);
    if (!row) throw new NotFoundException('Diagram not found');
    return this.toDto(row);
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.diagramsRepo.delete(id);
    if (!deleted) throw new NotFoundException('Diagram not found');
  }

  // ── Topology import ──

  async importTopology(service?: string): Promise<DiagramGraph> {
    const topology = await this.topologyRepo.getTopology(service);
    return this.topologyToDiagramGraph(topology);
  }

  // ── Code generation ──

  async generate(
    body: { diagramId?: string; graph?: DiagramGraph },
  ): Promise<{ validation: ValidationResult; result?: GenerationResult }> {
    const { nodes, edges } = await this.resolveGraph(body);
    const validation = this.validator.validate(nodes, edges);

    if (!validation.valid) {
      return { validation };
    }

    const result = buildFiles(nodes, edges);
    return { validation, result };
  }

  async resolveGraph(body: {
    diagramId?: string;
    graph?: DiagramGraph;
  }): Promise<DiagramGraph> {
    if (body.graph) return body.graph;
    if (body.diagramId) {
      const row = await this.diagramsRepo.findById(body.diagramId);
      if (!row) throw new BadRequestException('Diagram not found');
      return row.graph;
    }
    throw new BadRequestException('Provide either diagramId or graph');
  }

  // ── Validation ──

  validate(nodes: any[], edges: any[]): ValidationResult {
    return this.validator.validate(nodes, edges);
  }

  private validateOnSave(name: string | undefined, graph: DiagramGraph): void {
    const structuralErrors: string[] = [];

    if (name !== undefined && !name.trim()) {
      structuralErrors.push('Diagram name cannot be empty');
    }

    if (!graph.nodes || !Array.isArray(graph.nodes)) {
      structuralErrors.push('Graph must contain a nodes array');
    }

    if (!graph.edges || !Array.isArray(graph.edges)) {
      structuralErrors.push('Graph must contain an edges array');
    }

    if (structuralErrors.length > 0) {
      throw new BadRequestException({ message: 'Invalid diagram', errors: structuralErrors });
    }

    // Run specification-based validation
    const result = this.validator.validate(graph.nodes, graph.edges);

    if (!result.valid) {
      throw new BadRequestException({
        message: 'Diagram validation failed',
        errors: result.errors.map((e) => e.message),
        warnings: result.warnings.map((w) => w.message),
        details: result,
      });
    }
  }

  // ── Mapping ──

  private toDto(row: DiagramRow): DiagramDto {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      nodes: row.graph.nodes,
      edges: row.graph.edges,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private toSummaryDto(row: DiagramRow): DiagramSummaryDto {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      nodeCount: row.graph?.nodes?.length ?? 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // ── Topology → Diagram conversion ──

  private topologyToDiagramGraph(topology: any): DiagramGraph {
    const nodes: any[] = [];
    const edges: any[] = [];
    let seq = 0;
    const uid = () => `import-${seq++}`;

    let x = 0;
    let y = 0;
    const step = 250;

    for (const cmd of topology.commands) {
      const cmdId = uid();
      const handlerId = uid();
      nodes.push({
        id: cmdId, type: 'command', position: { x, y },
        data: { name: cmd.commandName.replace(/Command$/, ''), fields: [] },
      });
      nodes.push({
        id: handlerId, type: 'handler', position: { x: x + step, y },
        data: { name: cmd.handlerName.replace(/Handler$/, ''), dependencies: [] },
      });
      edges.push({ id: uid(), source: cmdId, target: handlerId, type: 'handles' });
      y += 100;
    }

    for (const q of topology.queries) {
      const qId = uid();
      const handlerId = uid();
      nodes.push({
        id: qId, type: 'query', position: { x, y },
        data: { name: q.queryName.replace(/Query$/, ''), fields: [], returnType: 'any' },
      });
      nodes.push({
        id: handlerId, type: 'handler', position: { x: x + step, y },
        data: { name: q.handlerName.replace(/Handler$|QueryHandler$/, ''), dependencies: [] },
      });
      edges.push({ id: uid(), source: qId, target: handlerId, type: 'handles' });
      y += 100;
    }

    x = step * 2;
    y = 0;
    for (const evt of topology.events) {
      const evtId = uid();
      nodes.push({
        id: evtId, type: 'event', position: { x, y },
        data: {
          name: evt.eventName.replace(/Event$/, ''), fields: [],
          isDomainEvent: !!evt.aggregateType,
          aggregateType: evt.aggregateType ?? undefined,
        },
      });
      let cy = y;
      for (const c of evt.consumers) {
        const cId = uid();
        nodes.push({
          id: cId, type: 'consumer', position: { x: x + step, y: cy },
          data: {
            name: c.consumerName.replace(/Consumer$/, ''),
            criticality: c.criticality, executionOrder: c.order,
          },
        });
        edges.push({ id: uid(), source: evtId, target: cId, type: 'consumes' });
        cy += 80;
      }
      y = Math.max(y + 100, cy);
    }

    x = step * 4;
    y = 0;
    for (const b of topology.behaviors) {
      const bId = uid();
      nodes.push({
        id: bId, type: 'behavior', position: { x, y },
        data: {
          name: b.behaviorName.replace(/Behavior$/, ''),
          priority: b.priority, scope: b.scope,
          targetType: b.requestTypeName ?? undefined,
        },
      });
      y += 100;
    }

    for (const a of topology.aggregates) {
      const aggId = uid();
      nodes.push({
        id: aggId, type: 'aggregate', position: { x, y },
        data: { name: a.aggregateType, idType: 'string', stateFields: [] },
      });
      for (const evtType of a.eventTypes) {
        const evtNode = nodes.find(
          (n: any) => n.type === 'event' && (n.data.name === evtType || n.data.name === evtType.replace(/Event$/, '')),
        );
        if (evtNode) {
          edges.push({ id: uid(), source: aggId, target: evtNode.id, type: 'applies' });
        }
      }
      y += 100;
    }

    return { nodes, edges };
  }
}
