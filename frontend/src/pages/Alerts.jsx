import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, Search, ShieldAlert } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatePanel from '../components/StatePanel';
import StatusCard from '../components/StatusCard';
import { requestJson } from '../lib/api';
import { formatDateTime, titleCase } from '../lib/format';

const severityClass = (severity) => {
  const value = String(severity || '').toLowerCase();
  if (value === 'critical') return 'border-red-200 bg-red-50 text-red-700';
  if (value === 'warning') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-slate-200 bg-slate-50 text-slate-700';
};

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [deviceId, setDeviceId] = useState('');
  const [showResolved, setShowResolved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [resolvingId, setResolvingId] = useState('');

  const counts = useMemo(
    () => ({
      total: alerts.length,
      critical: alerts.filter((alert) => alert.severity === 'Critical').length,
      warning: alerts.filter((alert) => alert.severity === 'Warning').length,
      resolved: alerts.filter((alert) => alert.resolved).length,
    }),
    [alerts]
  );

  const loadAlerts = useCallback(async (nextDeviceId = '', nextShowResolved = false) => {
    setIsLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      const normalizedDeviceId = nextDeviceId.trim();
      if (normalizedDeviceId) params.set('deviceId', normalizedDeviceId);
      if (!nextShowResolved) params.set('resolved', 'false');

      const query = params.toString() ? `?${params.toString()}` : '';
      const data = await requestJson(`/api/alerts${query}`);
      setAlerts(data);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const resolveAlert = async (id) => {
    setResolvingId(id);
    setError('');

    try {
      await requestJson(`/api/alerts/${id}/resolve`, { method: 'PUT' });
      setAlerts((previous) =>
        showResolved
          ? previous.map((alert) => (alert.id === id ? { ...alert, resolved: true } : alert))
          : previous.filter((alert) => alert.id !== id)
      );
    } catch (resolveError) {
      setError(resolveError.message);
    } finally {
      setResolvingId('');
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void loadAlerts();
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [loadAlerts]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Alerts"
        description="Review safety warnings, critical risks, and resolved alert history."
      >
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={deviceId}
              onChange={(event) => setDeviceId(event.target.value)}
              className="input w-full pl-9 sm:w-52"
              placeholder="Device ID"
            />
          </div>
          <label className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={showResolved}
              onChange={(event) => setShowResolved(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Include resolved
          </label>
          <button type="button" onClick={() => loadAlerts(deviceId, showResolved)} disabled={isLoading} className="btn-outline">
            <RefreshCw className={isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            Refresh
          </button>
        </div>
      </PageHeader>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Alert action failed: {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatusCard title="Visible Alerts" value={counts.total} status="Neutral" icon={ShieldAlert} description="Current list count" />
        <StatusCard title="Critical" value={counts.critical} status={counts.critical ? 'Risk' : 'Normal'} icon={AlertTriangle} description="Needs immediate review" />
        <StatusCard title="Warning" value={counts.warning} status={counts.warning ? 'Warning' : 'Normal'} icon={ShieldAlert} description="Needs monitoring" />
        <StatusCard title="Resolved" value={counts.resolved} status="Normal" icon={CheckCircle2} description="Closed in this view" />
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Alert Queue</h2>
            <p className="mt-1 text-xs text-slate-500">Resolve alerts after checking the patient/device condition.</p>
          </div>
        </div>
        <div className="card-body">
          {isLoading && alerts.length === 0 ? (
            <StatePanel type="loading" title="Loading alerts" message="Checking the backend alert queue." />
          ) : alerts.length === 0 ? (
            <StatePanel title="No alerts found" message="No matching safety events are currently stored." />
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {alerts.map((alert) => (
                <div key={alert.id} className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`badge ${severityClass(alert.severity)}`}>{titleCase(alert.severity)}</span>
                        {alert.resolved && (
                          <span className="badge border-emerald-200 bg-emerald-50 text-emerald-700">Resolved</span>
                        )}
                      </div>
                      <h3 className="mt-3 text-base font-semibold text-slate-900">{alert.type}</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{alert.message}</p>
                      <p className="mt-2 text-xs text-slate-500">
                        {alert.device_id} · {formatDateTime(alert.created_at)}
                      </p>
                    </div>
                    {!alert.resolved && (
                      <button
                        type="button"
                        onClick={() => resolveAlert(alert.id)}
                        disabled={resolvingId === alert.id}
                        className="btn-outline shrink-0"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {resolvingId === alert.id ? 'Saving' : 'Resolve'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
