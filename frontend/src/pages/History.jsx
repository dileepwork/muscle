import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, CheckCircle2, Database, RefreshCw, Search, ShieldAlert } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatePanel from '../components/StatePanel';
import StatusCard from '../components/StatusCard';
import { requestJson } from '../lib/api';
import {
  formatDateTime,
  formatNumber,
  normalizeSensorRow,
  riskStatus,
  summarizeSensorRows,
  titleCase,
} from '../lib/format';

export default function History() {
  const [rows, setRows] = useState([]);
  const [deviceId, setDeviceId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const summary = useMemo(() => summarizeSensorRows(rows), [rows]);

  const loadHistory = useCallback(async (nextDeviceId = '') => {
    setIsLoading(true);
    setError('');

    try {
      const normalizedDeviceId = nextDeviceId.trim();
      const query = normalizedDeviceId ? `?device_id=${encodeURIComponent(normalizedDeviceId)}` : '';
      const data = await requestJson(`/api/sensor-data/history${query}`);
      setRows(data.map(normalizeSensorRow));
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void loadHistory();
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [loadHistory]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="History Logs"
        description="Review stored sensor data, posture quality, and risk events from Supabase."
      >
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={deviceId}
              onChange={(event) => setDeviceId(event.target.value)}
              className="input w-full pl-9 sm:w-56"
              placeholder="Device ID"
            />
          </div>
          <button type="button" onClick={() => loadHistory(deviceId)} disabled={isLoading} className="btn-outline">
            <RefreshCw className={isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            Search
          </button>
        </div>
      </PageHeader>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          History could not be loaded: {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatusCard
          title="Samples"
          value={summary.total}
          status="Neutral"
          icon={Database}
          description="Latest records returned"
        />
        <StatusCard
          title="Average RMS"
          value={`${formatNumber(summary.avgRms)} uV`}
          status="Neutral"
          icon={Activity}
          description="Mean effort across this view"
        />
        <StatusCard
          title="Good Posture"
          value={`${summary.goodPostureRate}%`}
          status={summary.goodPostureRate >= 80 ? 'Normal' : 'Warning'}
          icon={CheckCircle2}
          description="Samples marked as good"
        />
        <StatusCard
          title="Risk Events"
          value={summary.warningCount + summary.riskCount}
          status={summary.riskCount > 0 ? 'Risk' : summary.warningCount > 0 ? 'Warning' : 'Normal'}
          icon={ShieldAlert}
          description={`${summary.riskCount} critical, ${summary.warningCount} warning`}
        />
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Sensor Records</h2>
            <p className="mt-1 text-xs text-slate-500">Newest records first. Use device filtering during hardware tests.</p>
          </div>
        </div>
        <div className="card-body">
          {isLoading && rows.length === 0 ? (
            <StatePanel type="loading" title="Loading history" message="Reading stored sensor data from the backend." />
          ) : rows.length === 0 ? (
            <StatePanel title="No history found" message="Send sensor data from the ESP32, then refresh this page." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-3 font-semibold">Time</th>
                    <th className="px-3 py-3 font-semibold">Device</th>
                    <th className="px-3 py-3 font-semibold">RMS</th>
                    <th className="px-3 py-3 font-semibold">Peak</th>
                    <th className="px-3 py-3 font-semibold">Posture</th>
                    <th className="px-3 py-3 font-semibold">Fatigue</th>
                    <th className="px-3 py-3 font-semibold">Risk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {rows.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-3 py-3 text-slate-600">{formatDateTime(row.created_at)}</td>
                      <td className="whitespace-nowrap px-3 py-3 font-medium text-slate-900">{row.device_id}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-600">{formatNumber(row.emg_rms)} uV</td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-600">{formatNumber(row.emg_peak)} uV</td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-600">{titleCase(row.posture)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-600">{titleCase(row.fatigue)}</td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <span
                          className={`badge ${
                            riskStatus(row.risk) === 'risk'
                              ? 'border-red-200 bg-red-50 text-red-700'
                              : riskStatus(row.risk) === 'warning'
                                ? 'border-amber-200 bg-amber-50 text-amber-700'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {titleCase(row.risk)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
