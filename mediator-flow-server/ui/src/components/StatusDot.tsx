interface StatusDotProps {
  status: 'completed' | 'failed' | 'compensated' | 'dispatched' | 'pending';
  size?: 'sm' | 'md';
}

const colors: Record<string, string> = {
  completed: 'bg-green-400',
  failed: 'bg-red-400',
  compensated: 'bg-orange-400',
  dispatched: 'bg-blue-400',
  pending: 'bg-gray-500',
};

export default function StatusDot({ status, size = 'sm' }: StatusDotProps) {
  const s = size === 'sm' ? 'w-2 h-2' : 'w-3 h-3';
  return <span className={`inline-block rounded-full ${s} ${colors[status] ?? colors.pending}`} />;
}
