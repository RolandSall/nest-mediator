import type { ToolDefinition } from './types';

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'get_diagram',
    description: 'Returns the current diagram state with all nodes and edges. Always call this before making edits so you know what already exists.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'add_node',
    description: 'Adds a new node to the diagram canvas. Returns the created node with its generated ID.',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['command', 'query', 'handler', 'event', 'consumer', 'behavior', 'aggregate'],
          description: 'The node type',
        },
        name: {
          type: 'string',
          description: 'PascalCase name for the node (e.g. CreateOrder, OrderCreatedHandler)',
        },
        fields: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              type: { type: 'string' },
            },
            required: ['name', 'type'],
          },
          description: 'Constructor fields (for command, query, event)',
        },
        returnType: {
          type: 'string',
          description: 'Return type (for query nodes only)',
        },
        criticality: {
          type: 'string',
          enum: ['critical', 'non-critical'],
          description: 'Consumer criticality (for consumer nodes only)',
        },
        executionOrder: {
          type: 'number',
          description: 'Execution order for critical consumers',
        },
        priority: {
          type: 'number',
          description: 'Pipeline priority (for behavior nodes only). Ranges: -100..0 exception handling, 0..99 logging, 100..199 validation, 200+ transaction',
        },
        scope: {
          type: 'string',
          enum: ['command', 'query', 'all'],
          description: 'Behavior scope (for behavior nodes only)',
        },
        targetType: {
          type: 'string',
          description: 'Specific command/query name this behavior targets (for behavior nodes only)',
        },
        isDomainEvent: {
          type: 'boolean',
          description: 'Whether this is a domain event for event sourcing (for event nodes only)',
        },
        aggregateType: {
          type: 'string',
          description: 'Aggregate type name (for domain events)',
        },
        aggregateIdField: {
          type: 'string',
          description: 'Field name that contains the aggregate ID (for domain events)',
        },
        idType: {
          type: 'string',
          description: 'Aggregate ID type (for aggregate nodes only)',
        },
        stateFields: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              type: { type: 'string' },
              default: { type: 'string' },
            },
            required: ['name', 'type'],
          },
          description: 'State fields (for aggregate nodes only)',
        },
        dependencies: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              type: { type: 'string' },
            },
            required: ['name', 'type'],
          },
          description: 'Injectable dependencies (for handler nodes only)',
        },
      },
      required: ['type', 'name'],
    },
  },
  {
    name: 'add_edge',
    description: 'Connects two nodes with an edge. The edge type is auto-inferred from the source and target node types. Valid connections: command->handler (handles), query->handler (handles), handler->event (publishes), event->consumer (consumes), consumer->event (compensates), aggregate->event (applies).',
    inputSchema: {
      type: 'object',
      properties: {
        sourceNodeId: {
          type: 'string',
          description: 'ID of the source node',
        },
        targetNodeId: {
          type: 'string',
          description: 'ID of the target node',
        },
      },
      required: ['sourceNodeId', 'targetNodeId'],
    },
  },
  {
    name: 'update_node',
    description: 'Updates properties of an existing node. Only include the fields you want to change.',
    inputSchema: {
      type: 'object',
      properties: {
        nodeId: { type: 'string', description: 'ID of the node to update' },
        name: { type: 'string' },
        fields: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              type: { type: 'string' },
            },
            required: ['name', 'type'],
          },
        },
        returnType: { type: 'string' },
        criticality: { type: 'string', enum: ['critical', 'non-critical'] },
        executionOrder: { type: 'number' },
        compensationEventId: { type: 'string' },
        priority: { type: 'number' },
        scope: { type: 'string', enum: ['command', 'query', 'all'] },
        targetType: { type: 'string' },
        isDomainEvent: { type: 'boolean' },
        aggregateType: { type: 'string' },
        aggregateIdField: { type: 'string' },
        idType: { type: 'string' },
        stateFields: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              type: { type: 'string' },
              default: { type: 'string' },
            },
            required: ['name', 'type'],
          },
        },
        dependencies: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              type: { type: 'string' },
            },
            required: ['name', 'type'],
          },
        },
      },
      required: ['nodeId'],
    },
  },
  {
    name: 'remove_node',
    description: 'Removes a node and all its connected edges from the diagram.',
    inputSchema: {
      type: 'object',
      properties: {
        nodeId: { type: 'string', description: 'ID of the node to remove' },
      },
      required: ['nodeId'],
    },
  },
  {
    name: 'remove_edge',
    description: 'Removes a specific edge from the diagram.',
    inputSchema: {
      type: 'object',
      properties: {
        edgeId: { type: 'string', description: 'ID of the edge to remove' },
      },
      required: ['edgeId'],
    },
  },
  {
    name: 'find_node',
    description: 'Searches for nodes by name and/or type. Returns matching nodes with their IDs.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Partial name match (case-insensitive)' },
        type: {
          type: 'string',
          enum: ['command', 'query', 'handler', 'event', 'consumer', 'behavior', 'aggregate'],
          description: 'Filter by node type',
        },
      },
      required: [],
    },
  },
  {
    name: 'validate_diagram',
    description: 'Runs validation on the current diagram. Returns errors and warnings about missing connections, duplicate names, and other issues.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'auto_layout',
    description: 'Automatically arranges all nodes using a hierarchical layout algorithm (dagre). Call this after adding multiple nodes to make the diagram readable.',
    inputSchema: {
      type: 'object',
      properties: {
        direction: {
          type: 'string',
          enum: ['LR', 'TB'],
          description: 'Layout direction: LR (left-to-right) or TB (top-to-bottom). Defaults to LR.',
        },
      },
      required: [],
    },
  },
];

export const SYSTEM_PROMPT = `You are an AI assistant that helps users design CQRS (Command Query Responsibility Segregation) flows on a visual architecture canvas. You can create and modify diagram nodes and edges using the provided tools.

## Node Types

1. **Command** - A request that changes state (e.g. CreateOrder, CancelOrder). Has constructor fields.
2. **Query** - A request that reads state (e.g. GetOrderById, ListOrders). Has constructor fields and a returnType.
3. **Handler** - Processes exactly one command or query. Can publish events and have injectable dependencies.
4. **Event** - Something that happened (e.g. OrderCreated, PaymentProcessed). Has fields. Can be a domain event (for event sourcing) with aggregateType and aggregateIdField.
5. **Consumer** - Reacts to an event. Can be 'critical' (with executionOrder and must have a compensation event) or 'non-critical'.
6. **Behavior** - A cross-cutting pipeline concern (logging, validation, etc.). Has priority (-100..0: exception handling, 0..99: logging, 100..199: validation, 200+: transaction), scope (command/query/all), and optional targetType.
7. **Aggregate** - An event-sourced entity. Has idType and stateFields.

## Edge Types (auto-inferred from source → target)

- **command → handler** = "handles" edge
- **query → handler** = "handles" edge
- **handler → event** = "publishes" edge
- **event → consumer** = "consumes" edge
- **consumer → event** = "compensates" edge (for compensation events)
- **aggregate → event** = "applies" edge (aggregate applies domain events)

## Validation Rules

- Each command/query must have exactly one handler (1:1 relationship)
- Handlers should have an incoming command/query and should publish events
- Domain events (isDomainEvent=true) must have an aggregate connected via "applies" edge
- Critical consumers MUST have a compensation event connected via "compensates" edge
- Aggregate nodes must have at least one domain event
- No duplicate names within the same node type

## nest-mediator Library Patterns

- Behaviors run in a pipeline before the handler, ordered by priority (lower runs first)
- Critical consumers run in-order and support saga-style compensation on failure
- Non-critical consumers run after critical ones, failures don't trigger compensation
- Event sourcing: Aggregates apply domain events to rebuild state

## Instructions

- Always call \`get_diagram\` first before making changes, so you understand the current state
- Use PascalCase for all node names (e.g. CreateOrder, not create_order)
- After adding multiple nodes and edges, suggest calling \`auto_layout\` to arrange them nicely
- When creating a typical CQRS flow: create the command/query first, then handler, then events, then consumers, then connect them all with edges
- When the user asks to "validate", use the \`validate_diagram\` tool
- Use \`find_node\` to look up node IDs when the user refers to nodes by name
- Be concise in your explanations but thorough in your tool usage`;
