import { type Step } from '../lib/api';
import { formatDuration, formatTime } from '../lib/formatters';

interface Props {
  step: Step;
}

export default function StepDetail({ step }: Props) {
  const isEventStep = step.type === 'EVENT_PUBLISHED' || step.type === 'COMPENSATING_EVENT_PUBLISHED';
  const isConsumerStep = step.type.startsWith('CRITICAL_CONSUMER_') ||
    step.type.startsWith('SYSTEM_CONSUMER_') || step.type.startsWith('NONCRITICAL_CONSUMER_');

  return (
    <>
      <div className="space-y-2 text-sm">
        <div>
          <span className="text-gray-500">Name:</span>{' '}
          <span className="text-gray-300 break-all">{step.name}</span>
        </div>
        <div>
          <span className="text-gray-500">Type:</span>{' '}
          <span className="text-gray-300 break-all">{step.type}</span>
        </div>
        {!isEventStep && (
          <div>
            <span className="text-gray-500">Duration:</span>{' '}
            <span className="text-gray-300">{formatDuration(step.durationMs)}</span>
          </div>
        )}
        {isEventStep && step.eventId && (
          <div>
            <span className="text-gray-500">Event ID:</span>{' '}
            <span className="text-gray-300 font-mono text-xs break-all">{step.eventId}</span>
          </div>
        )}
        {isConsumerStep && step.eventId && (
          <div>
            <span className="text-gray-500">Handling Event:</span>{' '}
            <span className="text-gray-300 font-mono text-xs break-all">{step.eventId}</span>
          </div>
        )}
        {isEventStep && step.causationId && (
          <div>
            <span className="text-gray-500">Caused By Event:</span>{' '}
            <span className="text-gray-300 font-mono text-xs break-all">{step.causationId}</span>
          </div>
        )}
        <div>
          <span className="text-gray-500">Timestamp:</span>{' '}
          <span className="text-gray-300">{formatTime(step.timestamp)}</span>
        </div>
      </div>
      {step.error && (
        <div className="mt-3 p-3 bg-red-950/50 border border-red-900 rounded text-sm text-red-300">
          {step.error}
        </div>
      )}
      {step.payload && (
        <div className="mt-3">
          <p className="text-xs text-gray-500 mb-1">Payload:</p>
          <pre className="bg-gray-950 p-3 rounded text-xs text-gray-400 overflow-auto max-h-40">
            {JSON.stringify(step.payload, null, 2)}
          </pre>
        </div>
      )}
      {step.metadata && (
        <div className="mt-3">
          <p className="text-xs text-gray-500 mb-1">Metadata:</p>
          <pre className="bg-gray-950 p-3 rounded text-xs text-gray-400 overflow-auto max-h-40">
            {JSON.stringify(step.metadata, null, 2)}
          </pre>
        </div>
      )}
    </>
  );
}
