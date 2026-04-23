import { useEffect, useState } from 'react';
import { Activity, Cpu, Radio, RefreshCw, ShieldAlert } from 'lucide-react';
import { io } from 'socket.io-client';
import PageHeader from '../components/PageHeader';
import StatePanel from '../components/StatePanel';
import StatusCard from '../components/StatusCard';
import { API_URL, requestJson } from '../lib/api';
import { formatDateTime, formatNumber, normalizeSensorRow, riskStatus, titleCase } from '../lib/format';

const statusFromRisk = (risk) => {
  const status = riskStatus(risk);
  if (status === 'risk') return 'Risk';
  if (status === 'warning') return 'Warning';
  return 'Normal';
};

export default function LiveMonitoring() {
  const [samples, setSamples] = useState([]);
  const [connection, setConnection] = useState('connecting');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const latest = samples[0] || null;

  const loadLatest = async () => {
    setIsLoading(true);
    setError('');

    try {
      const rows = await requestJson('/api/sensor-data/latest');
      setSamples(rows.map(normalizeSensorRow));
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLatest();

    const socket = io(API_URL, { reconnectionAttempts: 3, timeout: 3000 });

    socket.on('connect', () => setConnection('connected'));
    socket.on('disconnect', () => setConnection('disconnected'));
    socket.on('connect_error', () => setConnection('disconnected'));
    socket.on('sensor_update', (payload) => {
      setConnection('connected');
      setSamples((previous) => [normalizeSensorRow(payload), ...previous].slice(0, 20));
    });

    return () => socket.disconnect();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live Monitoring"
        description="Focused real-time telemetry for the active ESP32 device."
      >
        <div
          className={`badge ${
            connection === 'connected'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-amber-200 bg-amber-50 text-amber-700'
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              connection === 'connected' ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
          />
          {connection === 'connected' ? 'Socket connected' : 'Waiting for stream'}
        </div>
        <button type="button" onClick={loadLatest} disabled={isLoading} className="btn-outline">
          <RefreshCw className={isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          Refresh
        </button>
      </PageHeader>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Could not load latest telemetry: {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatusCard
          title="Device"
          value={latest?.device_id || 'Waiting'}
          status={connection === 'connected' ? 'Normal' : 'Neutral'}
          icon={Cpu}
          description={latest ? `Last sample ${formatDateTime(latest.created_at)}` : 'No samples received yet'}
        />
        <StatusCard
          title="RMS"
          value={latest ? `${formatNumber(latest.emg_rms)} uV` : '--'}
          status={latest ? statusFromRisk(latest.risk) : 'Neutral'}
          icon={Activity}
          description="Smoothed EMG effort"
        />
        <StatusCard
          title="Peak"
          value={latest ? `${formatNumber(latest.emg_peak)} uV` : '--'}
          status="Neutral"
          icon={Radio}
          description="Highest value in latest interval"
        />
        <StatusCard
          title="Risk"
          value={latest ? titleCase(latest.risk) : '--'}
          status={latest ? statusFromRisk(latest.risk) : 'Neutral'}
          icon={ShieldAlert}
          description={latest ? `${titleCase(latest.fatigue)} fatigue, ${titleCase(latest.posture)} posture` : 'Waiting'}
        />
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Recent Samples</h2>
            <p className="mt-1 text-xs text-slate-500">Newest sensor packets received by the backend.</p>
          </div>
        </div>
        <div className="card-body">
          {isLoading && samples.length === 0 ? (
            <StatePanel type="loading" title="Loading telemetry" message="Checking the backend for the latest samples." />
          ) : samples.length === 0 ? (
            <StatePanel
              title="No live samples yet"
              message="Start the ESP32 firmware and send data to POST /api/sensor-data/stream."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-3 font-semibold">Time</th>
                    <th className="px-3 py-3 font-semibold">Device</th>
                    <th className="px-3 py-3 font-semibold">Raw</th>
                    <th className="px-3 py-3 font-semibold">RMS</th>
                    <th className="px-3 py-3 font-semibold">Pitch</th>
                    <th className="px-3 py-3 font-semibold">Roll</th>
                    <th className="px-3 py-3 font-semibold">Risk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {samples.map((sample) => (
                    <tr key={sample.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-3 py-3 text-slate-600">{formatDateTime(sample.created_at)}</td>
                      <td className="whitespace-nowrap px-3 py-3 font-medium text-slate-900">{sample.device_id}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-600">{formatNumber(sample.emg_raw, 0)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-600">{formatNumber(sample.emg_rms)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-600">{formatNumber(sample.pitch)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-600">{formatNumber(sample.roll)}</td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <span
                          className={`badge ${
                            riskStatus(sample.risk) === 'risk'
                              ? 'border-red-200 bg-red-50 text-red-700'
                              : riskStatus(sample.risk) === 'warning'
                                ? 'border-amber-200 bg-amber-50 text-amber-700'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {titleCase(sample.risk)}
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
