import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, CheckCircle2, RefreshCw, ShieldAlert } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatePanel from '../components/StatePanel';
import StatusCard from '../components/StatusCard';
import { requestJson } from '../lib/api';
import { formatDateTime, formatNumber, normalizeSensorRow, riskStatus, titleCase } from '../lib/format';

const groupByDay = (rows) => {
  const groups = new Map();

  rows.forEach((row) => {
    const key = new Date(row.created_at).toLocaleDateString();
    const existing = groups.get(key) || [];
    existing.push(row);
    groups.set(key, existing);
  });

  return Array.from(groups.entries())
    .slice(0, 7)
    .map(([day, samples]) => {
      const normalCount = samples.filter((sample) => riskStatus(sample.risk) === 'normal').length;
      const avgRms = samples.reduce((sum, sample) => sum + sample.emg_rms, 0) / samples.length;

      return {
        day,
        samples: samples.length,
        avgRms,
        safeRate: Math.round((normalCount / samples.length) * 100),
      };
    });
};

export default function Rehabilitation() {
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const progress = useMemo(() => groupByDay(rows), [rows]);
  const latest = rows[0] || null;
  const safeSamples = rows.filter((row) => riskStatus(row.risk) === 'normal').length;
  const safeRate = rows.length ? Math.round((safeSamples / rows.length) * 100) : 0;
  const averageRms = rows.length ? rows.reduce((sum, row) => sum + row.emg_rms, 0) / rows.length : 0;
  const riskEvents = rows.filter((row) => riskStatus(row.risk) !== 'normal').length;

  const loadProgress = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const data = await requestJson('/api/sensor-data/history');
      setRows(data.map(normalizeSensorRow));
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void loadProgress();
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [loadProgress]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rehabilitation Progress"
        description="Simple recovery indicators derived from stored EMG, posture, and risk samples."
      >
        <button type="button" onClick={loadProgress} disabled={isLoading} className="btn-outline">
          <RefreshCw className={isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          Refresh
        </button>
      </PageHeader>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Progress data could not be loaded: {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatusCard
          title="Safe Samples"
          value={`${safeRate}%`}
          status={safeRate >= 80 ? 'Normal' : safeRate >= 60 ? 'Warning' : 'Risk'}
          icon={CheckCircle2}
          description="Normal-risk samples in history"
        />
        <StatusCard
          title="Average RMS"
          value={`${formatNumber(averageRms)} uV`}
          status="Neutral"
          icon={Activity}
          description="Effort trend baseline"
        />
        <StatusCard
          title="Risk Events"
          value={riskEvents}
          status={riskEvents > 5 ? 'Risk' : riskEvents > 0 ? 'Warning' : 'Normal'}
          icon={ShieldAlert}
          description="Warnings and critical samples"
        />
        <StatusCard
          title="Latest Status"
          value={latest ? titleCase(latest.risk) : '--'}
          status={latest ? (riskStatus(latest.risk) === 'normal' ? 'Normal' : 'Warning') : 'Neutral'}
          icon={BarChart3}
          description={latest ? formatDateTime(latest.created_at) : 'No session data yet'}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="card xl:col-span-2">
          <div className="card-header">
            <div>
              <h2 className="card-title">Daily Recovery Trend</h2>
              <p className="mt-1 text-xs text-slate-500">Higher safe rate and stable RMS usually indicate better control.</p>
            </div>
          </div>
          <div className="card-body">
            {isLoading && rows.length === 0 ? (
              <StatePanel type="loading" title="Loading progress" message="Reading the latest rehabilitation history." />
            ) : progress.length === 0 ? (
              <StatePanel title="No rehabilitation data" message="Complete a monitored session to generate progress indicators." />
            ) : (
              <div className="space-y-4">
                {progress.map((day) => (
                  <div key={day.day} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{day.day}</p>
                        <p className="text-xs text-slate-500">
                          {day.samples} samples · Avg RMS {formatNumber(day.avgRms)} uV
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-slate-700">{day.safeRate}% safe</p>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${
                          day.safeRate >= 80 ? 'bg-emerald-500' : day.safeRate >= 60 ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${day.safeRate}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Session Guidance</h2>
              <p className="mt-1 text-xs text-slate-500">Based on the current history window.</p>
            </div>
          </div>
          <div className="card-body space-y-4 text-sm leading-6 text-slate-600">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="font-semibold text-slate-900">Recommended focus</p>
              <p className="mt-1">
                {riskEvents > 0
                  ? 'Reduce intensity and review posture before increasing load.'
                  : 'Maintain current intensity and continue stable repetitions.'}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="font-semibold text-slate-900">Accuracy note</p>
              <p className="mt-1">
                Run calibration for each user before comparing RMS values across sessions.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
