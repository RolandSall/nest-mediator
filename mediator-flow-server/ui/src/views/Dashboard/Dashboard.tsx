import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { getTraceStatus, formatDuration, formatTimeShort } from '../../lib/formatters';
import Card from '../../components/Card';
import StatusDot from '../../components/StatusDot';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';

export default function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: () => api.getStats(),
  });

  const { data: traces } = useQuery({
    queryKey: ['traces', 'recent'],
    queryFn: () => api.getTraces({ limit: 20 }),
  });

  useAutoRefresh([['stats'], ['traces', 'recent']], 5000);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Dashboard</h1>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card title="Commands / min" value={stats?.commandsPerMin ?? '-'} />
        <Card title="Queries / min" value={stats?.queriesPerMin ?? '-'} />
        <Card
          title="Error Rate"
          value={stats ? `${stats.errorRate}%` : '-'}
          className={stats && stats.errorRate > 5 ? 'border-red-800' : ''}
        />
        <Card
          title="Compensations"
          value={stats?.compensationCount ?? '-'}
          className={stats && stats.compensationCount > 0 ? 'border-orange-800' : ''}
        />
      </div>

      {/* Recent traces */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg">
        <div className="px-5 py-3 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-gray-400">Recent Traces</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 text-xs uppercase border-b border-gray-800">
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Entry</th>
                <th className="px-4 py-2">Service</th>
                <th className="px-4 py-2">Steps</th>
                <th className="px-4 py-2">Duration</th>
                <th className="px-4 py-2">Time</th>
              </tr>
            </thead>
            <tbody>
              {traces?.traces.map((t) => (
                <tr
                  key={t.correlationId}
                  className="border-b border-gray-800/50 hover:bg-gray-800/30"
                >
                  <td className="px-4 py-2">
                    <StatusDot status={getTraceStatus(t)} />
                  </td>
                  <td className="px-4 py-2">
                    <Link
                      to={`/traces/${t.correlationId}`}
                      className="text-blue-400 hover:underline"
                    >
                      {t.entryName}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-gray-500">{t.serviceName}</td>
                  <td className="px-4 py-2">
                    {t.stepCount}
                    {t.errorCount > 0 && (
                      <span className="text-red-400 ml-1">({t.errorCount} err)</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-gray-400">
                    {formatDuration(t.durationMs)}
                  </td>
                  <td className="px-4 py-2 text-gray-500 text-xs">
                    {formatTimeShort(t.startedAt)}
                  </td>
                </tr>
              ))}
              {(!traces || traces.traces.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-600">
                    No traces yet. Start sending requests to your instrumented service.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top errors */}
      {stats && stats.topErrors.length > 0 && (
        <div className="bg-gray-900 border border-red-900/50 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-red-400 mb-3">Top Errors</h2>
          <div className="space-y-2">
            {stats.topErrors.slice(0, 5).map((e, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-gray-300">{e.name}</span>
                <span className="text-red-400">{e.count}x - {e.error}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
