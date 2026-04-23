import { useEffect, useState } from 'react';
import { Cpu, Database, RefreshCw, Settings as SettingsIcon, ShieldCheck } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatePanel from '../components/StatePanel';
import StatusCard from '../components/StatusCard';
import { API_URL, requestJson } from '../lib/api';
import { formatDateTime, formatNumber } from '../lib/format';

export default function Settings() {
  const [deviceId, setDeviceId] = useState('ESP32_01');
  const [deviceStatus, setDeviceStatus] = useState(null);
  const [calibration, setCalibration] = useState(null);
  const [health, setHealth] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSettings = async () => {
    setIsLoading(true);
    setError('');

    try {
      const [healthPayload, statusPayload, calibrationPayload] = await Promise.all([
        requestJson('/api/health'),
        requestJson(`/api/device/status?deviceId=${encodeURIComponent(deviceId.trim() || 'ESP32_01')}`),
        requestJson(`/api/device/calibration/${encodeURIComponent(deviceId.trim() || 'ESP32_01')}`),
      ]);

      setHealth(healthPayload);
      setDeviceStatus(statusPayload);
      setCalibration(calibrationPayload);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Settings"
        description="Check backend connectivity, active device details, and calibration values used by the risk engine."
      >
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <input
            value={deviceId}
            onChange={(event) => setDeviceId(event.target.value)}
            className="input w-full sm:w-52"
            placeholder="Device ID"
          />
          <button type="button" onClick={loadSettings} disabled={isLoading} className="btn-outline">
            <RefreshCw className={isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            Refresh
          </button>
        </div>
      </PageHeader>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Settings could not be loaded: {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatusCard
          title="Backend"
          value={health?.status === 'ok' ? 'Online' : 'Checking'}
          status={health?.status === 'ok' ? 'Normal' : 'Neutral'}
          icon={Database}
          description={health?.timestamp ? `Updated ${formatDateTime(health.timestamp)}` : API_URL}
        />
        <StatusCard
          title="Device Status"
          value={deviceStatus?.status || 'Unknown'}
          status={deviceStatus?.status === 'Connected' ? 'Normal' : 'Warning'}
          icon={Cpu}
          description={deviceStatus?.deviceId || deviceId}
        />
        <StatusCard
          title="Max RMS"
          value={`${formatNumber(calibration?.max_rms, 0)} uV`}
          status="Neutral"
          icon={ShieldCheck}
          description="Used for fatigue ratio"
        />
        <StatusCard
          title="Baseline"
          value={`${formatNumber(calibration?.baseline_rms, 0)} uV`}
          status="Neutral"
          icon={SettingsIcon}
          description="Relaxed muscle reference"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Risk Engine Rules</h2>
              <p className="mt-1 text-xs text-slate-500">Current backend logic used for live classification.</p>
            </div>
          </div>
          <div className="card-body">
            {isLoading && !calibration ? (
              <StatePanel type="loading" title="Loading settings" message="Checking backend and device calibration." />
            ) : (
              <div className="space-y-3 text-sm">
                <div className="rounded-lg border border-slate-200 p-4">
                  <p className="font-semibold text-slate-900">Fatigue</p>
                  <p className="mt-1 text-slate-600">
                    Low below 30% of calibrated max RMS, moderate above 30%, high above 60%.
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 p-4">
                  <p className="font-semibold text-slate-900">Posture</p>
                  <p className="mt-1 text-slate-600">
                    Bad posture when pitch is above 30 deg or roll is above 20 deg.
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 p-4">
                  <p className="font-semibold text-slate-900">Risk</p>
                  <p className="mt-1 text-slate-600">
                    Critical when high fatigue and bad posture happen together. Warning when either one is unsafe.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Integration Values</h2>
              <p className="mt-1 text-xs text-slate-500">Use these values when testing frontend, backend, and ESP32 together.</p>
            </div>
          </div>
          <div className="card-body space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Backend API</p>
              <code className="mt-2 block overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                {API_URL}
              </code>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">ESP32 Stream Endpoint</p>
              <code className="mt-2 block overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                {API_URL}/api/sensor-data/stream
              </code>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Firmware</p>
              <p className="mt-2 text-sm text-slate-600">
                {deviceStatus?.firmwareVersion || 'No firmware status loaded'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
