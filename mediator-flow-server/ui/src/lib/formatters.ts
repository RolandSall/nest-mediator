export function getTraceStatus(t: { hasErrors: boolean; hasCompensations: boolean }): 'failed' | 'compensated' | 'completed' {
  return t.hasErrors ? 'failed' : t.hasCompensations ? 'compensated' : 'completed';
}

export function formatDuration(ms?: number): string {
  if (ms == null) return '-';
  return `${Math.round(ms)}ms`;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function formatTimeShort(iso: string): string {
  return new Date(iso).toLocaleTimeString();
}
