import { type DiagramNode, type DiagramNodeData, type DiagramNodeType, getNodeConfig } from '../../diagram';

interface Props {
  node: DiagramNode;
  nodes: DiagramNode[];
  onUpdate: (id: string, data: Partial<DiagramNodeData>) => void;
  onClose: () => void;
}

export default function NodeConfigPanel({ node, nodes, onUpdate, onClose }: Props) {
  const config = getNodeConfig(node.type);
  const d = node.data;

  const set = (patch: Partial<DiagramNodeData>) => onUpdate(node.id, patch);

  const eventNodes = nodes.filter((n) => n.type === 'event');
  const requestNodes = nodes.filter((n) => n.type === 'command' || n.type === 'query');

  return (
    <div className="absolute top-0 right-0 w-80 h-full bg-gray-900 border-l border-gray-800 p-4 overflow-y-auto z-20">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm" style={{ background: config.color }} />
          <h3 className="text-sm font-bold text-gray-300">{config.label} Config</h3>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-300">x</button>
      </div>

      <div className="space-y-4">
        {/* Name — all types */}
        <Field label="Name">
          <input
            className="input-field"
            value={d.name ?? ''}
            onChange={(e) => set({ name: e.target.value })}
            placeholder={`${config.label} name`}
          />
        </Field>

        {/* Command / Query — fields */}
        {(node.type === 'command' || node.type === 'query') && (
          <>
            <FieldList
              label="Constructor Fields"
              items={d.fields ?? []}
              onChange={(fields) => set({ fields })}
            />
            {node.type === 'query' && (
              <Field label="Return Type">
                <input
                  className="input-field"
                  value={d.returnType ?? ''}
                  onChange={(e) => set({ returnType: e.target.value })}
                  placeholder="e.g. UserDto[]"
                />
              </Field>
            )}
          </>
        )}

        {/* Event */}
        {node.type === 'event' && (
          <>
            <FieldList
              label="Fields"
              items={d.fields ?? []}
              onChange={(fields) => set({ fields })}
            />
            <Field label="Domain Event">
              <label className="flex items-center gap-2 text-xs text-gray-300">
                <input
                  type="checkbox"
                  checked={d.isDomainEvent ?? false}
                  onChange={(e) => set({ isDomainEvent: e.target.checked })}
                />
                @DomainEvent
              </label>
            </Field>
            {d.isDomainEvent && (
              <>
                <Field label="Aggregate Type">
                  <input
                    className="input-field"
                    value={d.aggregateType ?? ''}
                    onChange={(e) => set({ aggregateType: e.target.value })}
                    placeholder="e.g. Order"
                  />
                </Field>
                <Field label="Aggregate ID Field">
                  <input
                    className="input-field"
                    value={d.aggregateIdField ?? ''}
                    onChange={(e) => set({ aggregateIdField: e.target.value })}
                    placeholder="e.g. orderId"
                  />
                </Field>
              </>
            )}
          </>
        )}

        {/* Handler */}
        {node.type === 'handler' && (
          <DependencyList
            items={d.dependencies ?? []}
            onChange={(dependencies) => set({ dependencies })}
          />
        )}

        {/* Consumer */}
        {node.type === 'consumer' && (
          <>
            <Field label="Criticality">
              <select
                className="input-field"
                value={d.criticality ?? 'non-critical'}
                onChange={(e) => set({ criticality: e.target.value as any })}
              >
                <option value="non-critical">Non-critical</option>
                <option value="critical">Critical</option>
              </select>
            </Field>
            {d.criticality === 'critical' && (
              <>
                <Field label="Execution Order">
                  <input
                    type="number"
                    className="input-field"
                    value={d.executionOrder ?? 0}
                    onChange={(e) => set({ executionOrder: parseInt(e.target.value) || 0 })}
                  />
                </Field>
                <Field label="Compensation Event">
                  <select
                    className="input-field"
                    value={d.compensationEventId ?? ''}
                    onChange={(e) => set({ compensationEventId: e.target.value || undefined })}
                  >
                    <option value="">None</option>
                    {eventNodes.map((en) => (
                      <option key={en.id} value={en.id}>
                        {en.data.name || 'Unnamed'}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            )}
          </>
        )}

        {/* Behavior */}
        {node.type === 'behavior' && (
          <>
            <Field label="Priority">
              <input
                type="number"
                className="input-field"
                value={d.priority ?? 0}
                onChange={(e) => set({ priority: parseInt(e.target.value) || 0 })}
              />
              <div className="text-[10px] text-gray-500 mt-1">
                -100..0: exception handling, 0..99: logging, 100..199: validation, 200+: transaction
              </div>
            </Field>
            <Field label="Scope">
              <div className="flex gap-3">
                {(['all', 'command', 'query'] as const).map((s) => (
                  <label key={s} className="flex items-center gap-1 text-xs text-gray-300">
                    <input
                      type="radio"
                      name="scope"
                      checked={(d.scope ?? 'all') === s}
                      onChange={() => set({ scope: s })}
                    />
                    {s}
                  </label>
                ))}
              </div>
            </Field>
            <Field label="Target Type (optional)">
              <select
                className="input-field"
                value={d.targetType ?? ''}
                onChange={(e) => set({ targetType: e.target.value || undefined })}
              >
                <option value="">All (no specific target)</option>
                {requestNodes.map((rn) => (
                  <option key={rn.id} value={rn.data.name}>
                    {rn.data.name || 'Unnamed'}
                  </option>
                ))}
              </select>
            </Field>
          </>
        )}

        {/* Aggregate */}
        {node.type === 'aggregate' && (
          <>
            <Field label="ID Type">
              <input
                className="input-field"
                value={d.idType ?? 'string'}
                onChange={(e) => set({ idType: e.target.value })}
                placeholder="e.g. string"
              />
            </Field>
            <StateFieldList
              items={d.stateFields ?? []}
              onChange={(stateFields) => set({ stateFields })}
            />
          </>
        )}
      </div>

      <style>{`
        .input-field {
          width: 100%;
          background: #111827;
          border: 1px solid #374151;
          border-radius: 4px;
          padding: 4px 8px;
          color: #e5e7eb;
          font-size: 12px;
          outline: none;
        }
        .input-field:focus { border-color: #3b82f6; }
      `}</style>
    </div>
  );
}

// ── Shared sub-components ──

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-gray-400 block mb-1">{label}</label>
      {children}
    </div>
  );
}

function FieldList({
  label,
  items,
  onChange,
}: {
  label: string;
  items: { name: string; type: string }[];
  onChange: (items: { name: string; type: string }[]) => void;
}) {
  return (
    <Field label={label}>
      {items.map((item, i) => (
        <div key={i} className="flex gap-1 mb-1">
          <input
            className="input-field flex-1"
            value={item.name}
            placeholder="name"
            onChange={(e) => {
              const next = [...items];
              next[i] = { ...next[i], name: e.target.value };
              onChange(next);
            }}
          />
          <input
            className="input-field flex-1"
            value={item.type}
            placeholder="type"
            onChange={(e) => {
              const next = [...items];
              next[i] = { ...next[i], type: e.target.value };
              onChange(next);
            }}
          />
          <button
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="text-red-400 hover:text-red-300 text-xs px-1"
          >
            x
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...items, { name: '', type: 'string' }])}
        className="text-xs text-blue-400 hover:text-blue-300"
      >
        + Add field
      </button>
    </Field>
  );
}

function DependencyList({
  items,
  onChange,
}: {
  items: { name: string; type: string }[];
  onChange: (items: { name: string; type: string }[]) => void;
}) {
  return (
    <Field label="Injectable Dependencies">
      {items.map((item, i) => (
        <div key={i} className="flex gap-1 mb-1">
          <input
            className="input-field flex-1"
            value={item.name}
            placeholder="name"
            onChange={(e) => {
              const next = [...items];
              next[i] = { ...next[i], name: e.target.value };
              onChange(next);
            }}
          />
          <input
            className="input-field flex-1"
            value={item.type}
            placeholder="type"
            onChange={(e) => {
              const next = [...items];
              next[i] = { ...next[i], type: e.target.value };
              onChange(next);
            }}
          />
          <button
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="text-red-400 hover:text-red-300 text-xs px-1"
          >
            x
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...items, { name: '', type: '' }])}
        className="text-xs text-blue-400 hover:text-blue-300"
      >
        + Add dependency
      </button>
    </Field>
  );
}

function StateFieldList({
  items,
  onChange,
}: {
  items: { name: string; type: string; default?: string }[];
  onChange: (items: { name: string; type: string; default?: string }[]) => void;
}) {
  return (
    <Field label="State Fields">
      {items.map((item, i) => (
        <div key={i} className="flex gap-1 mb-1">
          <input
            className="input-field flex-1"
            value={item.name}
            placeholder="name"
            onChange={(e) => {
              const next = [...items];
              next[i] = { ...next[i], name: e.target.value };
              onChange(next);
            }}
          />
          <input
            className="input-field w-16"
            value={item.type}
            placeholder="type"
            onChange={(e) => {
              const next = [...items];
              next[i] = { ...next[i], type: e.target.value };
              onChange(next);
            }}
          />
          <input
            className="input-field w-16"
            value={item.default ?? ''}
            placeholder="default"
            onChange={(e) => {
              const next = [...items];
              next[i] = { ...next[i], default: e.target.value || undefined };
              onChange(next);
            }}
          />
          <button
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="text-red-400 hover:text-red-300 text-xs px-1"
          >
            x
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...items, { name: '', type: 'string' }])}
        className="text-xs text-blue-400 hover:text-blue-300"
      >
        + Add state field
      </button>
    </Field>
  );
}
