import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { getTraceStatus, formatDuration, formatTime } from '../../lib/formatters';
import StatusDot from '../../components/StatusDot';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';

const LIMIT = 50;

export default function TraceList() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['traces', page, search, statusFilter],
    queryFn: () =>
      api.getTraces({
        page,
        limit: LIMIT,
        search: search || undefined,
        hasErrors: statusFilter === 'error' ? true : statusFilter === 'ok' ? false : undefined,
        hasCompensations: statusFilter === 'compensated' ? true : undefined,
      }),
  });

  useAutoRefresh([['traces', String(page), search, statusFilter]], 5000);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Traces</h1>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Search by name or correlationId..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-300 outline-none w-64 placeholder-gray-600"
          />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-300"
          >
            <option value="all">All</option>
            <option value="ok">OK</option>
            <option value="error">Errors</option>
            <option value="compensated">Compensated</option>
          </select>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 text-xs uppercase border-b border-gray-800">
              <th className="px-4 py-2">#</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Correlation ID</th>
              <th className="px-4 py-2">Entry</th>
              <th className="px-4 py-2">Service</th>
              <th className="px-4 py-2">Steps</th>
              <th className="px-4 py-2">Errors</th>
              <th className="px-4 py-2">Duration</th>
              <th className="px-4 py-2">Time</th>
            </tr>
          </thead>
          <tbody>
            {data?.traces.map((t, idx) => (
              <tr key={t.correlationId} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="px-4 py-2 text-gray-500 font-mono text-xs">
                  {(page - 1) * LIMIT + idx + 1}
                </td>
                <td className="px-4 py-2">
                  <StatusDot status={getTraceStatus(t)} />
                </td>
                <td className="px-4 py-2">
                  <Link
                    to={`/traces/${t.correlationId}`}
                    className="text-blue-400 hover:underline font-mono text-xs"
                  >
                    {t.correlationId.slice(0, 8)}...
                  </Link>
                </td>
                <td className="px-4 py-2 text-gray-300">{t.entryName}</td>
                <td className="px-4 py-2 text-gray-500">{t.serviceName}</td>
                <td className="px-4 py-2">{t.stepCount}</td>
                <td className="px-4 py-2">
                  {t.errorCount > 0 ? (
                    <span className="text-red-400">{t.errorCount}</span>
                  ) : (
                    <span className="text-gray-600">0</span>
                  )}
                </td>
                <td className="px-4 py-2 text-gray-400">
                  {formatDuration(t.durationMs)}
                </td>
                <td className="px-4 py-2 text-gray-500 text-xs">
                  {formatTime(t.startedAt)}
                </td>
              </tr>
            ))}
            {isLoading && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-600">
                  Loading...
                </td>
              </tr>
            )}
            {!isLoading && data?.traces.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-600">
                  No traces found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.total > data.limit && (
        <div className="flex items-center justify-center gap-4">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1 bg-gray-800 rounded text-sm disabled:opacity-30"
          >
            Prev
          </button>
          <span className="text-sm text-gray-500">
            Page {page} of {Math.ceil(data.total / data.limit)}
          </span>
          <button
            disabled={page >= Math.ceil(data.total / data.limit)}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1 bg-gray-800 rounded text-sm disabled:opacity-30"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
