import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Database, RefreshCw, Search, Shield } from 'lucide-react';
import { requestJson } from '../lib/api';
import { formatDateTime, formatNumber, normalizeSensorRow, riskStatus, summarizeSensorRows, titleCase } from '../lib/format';

function SummaryCard({ label, value, sub }) {
  return (
    <div className="card p-5">
      <p className="text-xs font-medium text-neutral-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-neutral-100">{value}</p>
      {sub && <p className="mt-1 text-xs text-neutral-600">{sub}</p>}
    </div>
  );
}

const RISK_STYLE = {
  risk:    'border-red-900 bg-red-950 text-red-400',
  warning: 'border-yellow-900 bg-yellow-950 text-yellow-400',
  normal:  'border-green-900 bg-green-950 text-green-400',
};

export default function History() {
  const [rows,      setRows]      = useState([]);
  const [deviceId,  setDeviceId]  = useState('');
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');

  const summary = useMemo(() => summarizeSensorRows(rows), [rows]);

  const load = useCallback(async (id = '') => {
    setLoading(true); setError('');
    try {
      const q    = id.trim() ? `?device_id=${encodeURIComponent(id.trim())}` : '';
      const data = await requestJson(`/api/sensor-data/history${q}`);
      setRows(data.map(normalizeSensorRow));
    } catch (e) { setError(e.message); }
    finally     { setLoading(false); }
  }, []);

  useEffect(() => { const t = setTimeout(() => void load(), 0); return () => clearTimeout(t); }, [load]);

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-base font-semibold text-neutral-100">History</h1>
          <p className="mt-0.5 text-xs text-neutral-500">Stored sensor records from the backend</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-500" />
            <input
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && load(deviceId)}
              className="input pl-8 w-44" placeholder="Filter by device…"
            />
          </div>
          <button onClick={() => load(deviceId)} disabled={loading} className="btn-outline">
            <RefreshCw className={loading ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
            Search
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-900 bg-red-950/60 px-4 py-3 text-sm text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard
          label="Records"
          value={summary.total}
          sub="Latest returned"
          icon={Database}
        />
        <SummaryCard
          label="Avg RMS"
          value={`${formatNumber(summary.avgRms)} uV`}
          sub="Mean muscle activity"
        />
        <SummaryCard
          label="Good posture"
          value={`${summary.goodPostureRate}%`}
          sub="Of all samples"
        />
        <SummaryCard
          label="Risk events"
          value={summary.warningCount + summary.riskCount}
          sub={`${summary.riskCount} critical · ${summary.warningCount} warning`}
        />
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Sensor Records</span>
          <span className="text-xs text-neutral-500">Newest first</span>
        </div>

        {loading && rows.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-sm text-neutral-500">
            Loading records…
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16">
            <Database className="h-8 w-8 text-neutral-700" />
            <p className="text-sm text-neutral-500">No records found. Stream data from your ESP32 first.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid #1f1f1f' }}>
                  {['Time', 'Device', 'RMS', 'Peak', 'Posture', 'Fatigue', 'Risk'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-neutral-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const rs = riskStatus(row.risk);
                  return (
                    <tr
                      key={row.id}
                      className="transition-colors hover:bg-neutral-900"
                      style={{ borderBottom: '1px solid #1a1a1a' }}
                    >
                      <td className="px-4 py-3 text-neutral-400">{formatDateTime(row.created_at)}</td>
                      <td className="px-4 py-3 font-medium text-neutral-200">{row.device_id}</td>
                      <td className="px-4 py-3 text-neutral-300">{formatNumber(row.emg_rms)} uV</td>
                      <td className="px-4 py-3 text-neutral-300">{formatNumber(row.emg_peak, 0)}</td>
                      <td className="px-4 py-3">
                        <span className={`flex items-center gap-1 text-xs font-medium ${row.posture === 'good' ? 'text-green-400' : 'text-yellow-400'}`}>
                          {row.posture === 'good'
                            ? <CheckCircle2 className="h-3.5 w-3.5" />
                            : <AlertTriangle className="h-3.5 w-3.5" />}
                          {titleCase(row.posture)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-neutral-300">{titleCase(row.fatigue)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${RISK_STYLE[rs]}`}>
                          {rs === 'risk' && <Shield className="h-3 w-3" />}
                          {titleCase(row.risk)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
