import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ActivitySquare, BrainCircuit, Clock, HeartPulse, RefreshCw, ShieldAlert } from 'lucide-react';
import { Line, LineChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { io } from 'socket.io-client';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import PageHeader from '../components/PageHeader';
import StatusCard from '../components/StatusCard';
import { API_URL, requestJson } from '../lib/api';
import { formatDateTime, formatNumber, normalizeSensorRow, riskStatus, titleCase } from '../lib/format';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const createEmptyChartData = () =>
  Array.from({ length: 20 }, (_, i) => ({
    time: `-${19 - i}s`,
    emg_raw: 0,
    emg_rms: 0,
  }));

const initialAnalysis = {
  device_id: 'ESP32_01',
  fatigue: 'low',
  posture: 'good',
  risk: 'normal',
  pitch: 0,
  roll: 0,
  created_at: null,
};

const LIVE_SAMPLE_MAX_AGE_MS = 15000;

const statusFromFatigue = (fatigue) => {
  if (fatigue === 'high') return 'Risk';
  if (fatigue === 'moderate') return 'Warning';
  return 'Normal';
};

const statusFromRisk = (risk) => {
  const status = riskStatus(risk);
  if (status === 'risk') return 'Risk';
  if (status === 'warning') return 'Warning';
  return 'Normal';
};

const toChartPoint = (sample) => ({
  time:
    sample.time ||
    new Date(sample.created_at || Date.now()).toLocaleTimeString([], {
      hour12: false,
      minute: '2-digit',
      second: '2-digit',
    }),
  emg_raw: sample.emg_raw,
  emg_rms: sample.emg_rms,
});

const isLiveSample = (sample) => {
  const createdAt = new Date(sample.created_at || 0).getTime();
  return Number.isFinite(createdAt) && Date.now() - createdAt <= LIVE_SAMPLE_MAX_AGE_MS;
};

export default function Dashboard() {
  const [data, setData] = useState(createEmptyChartData);
  const [alerts, setAlerts] = useState([]);
  const [streamStatus, setStreamStatus] = useState('waiting');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [currentAnalysis, setCurrentAnalysis] = useState(initialAnalysis);

  const socketRef = useRef(null);
  const lastSampleAtRef = useRef(0);

  const pushSample = useCallback((sample) => {
    lastSampleAtRef.current = Date.now();
    setStreamStatus('live');
    setData((previous) => [...previous.slice(1), toChartPoint(sample)]);
    setCurrentAnalysis(sample);
  }, []);

  const loadInitialData = useCallback(async () => {
    setIsRefreshing(true);
    setLoadError('');

    try {
      const [latestRows, alertRows] = await Promise.all([
        requestJson('/api/sensor-data/latest'),
        requestJson('/api/alerts?resolved=false'),
      ]);

      const samples = latestRows.map(normalizeSensorRow).filter(isLiveSample).reverse();
      if (samples.length) {
        const latestSample = samples[samples.length - 1];
        const padded = [...createEmptyChartData(), ...samples.map(toChartPoint)].slice(-20);
        setData(padded);
        setCurrentAnalysis(latestSample);
        lastSampleAtRef.current = Date.now();
        setStreamStatus('live');
      } else {
        setData(createEmptyChartData());
        setCurrentAnalysis(initialAnalysis);
        lastSampleAtRef.current = 0;
        setStreamStatus('waiting');
      }

      setAlerts(
        alertRows.slice(0, 10).map((alert) => ({
          id: alert.id,
          time: formatDateTime(alert.created_at),
          type: alert.type,
          desc: alert.message,
          level: alert.severity,
        }))
      );
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const initialLoadId = setTimeout(() => {
      void loadInitialData();
    }, 0);

    socketRef.current = io(API_URL, { reconnectionAttempts: 3, timeout: 3000 });

    socketRef.current.on('sensor_update', (payload) => {
      const sample = normalizeSensorRow(payload);
      pushSample(sample);

      if (riskStatus(sample.risk) !== 'normal') {
        setAlerts((previous) => {
          const nextAlert = {
            id: `${Date.now()}-${sample.risk}`,
            time: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' }),
            type: sample.risk === 'critical' ? 'Critical Risk Detected' : 'Safety Warning',
            desc: `Fatigue: ${titleCase(sample.fatigue)}, Posture: ${titleCase(sample.posture)}`,
            level: sample.risk === 'critical' ? 'Critical' : 'Warning',
          };

          return [nextAlert, ...previous].slice(0, 10);
        });
      }
    });

    const staleCheckInterval = setInterval(() => {
      if (!lastSampleAtRef.current || Date.now() - lastSampleAtRef.current <= LIVE_SAMPLE_MAX_AGE_MS) return;

      lastSampleAtRef.current = 0;
      setStreamStatus('waiting');
      setCurrentAnalysis(initialAnalysis);
      setData(createEmptyChartData());
    }, 1000);

    return () => {
      clearTimeout(initialLoadId);
      clearInterval(staleCheckInterval);
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [loadInitialData, pushSample]);

  const isLive = streamStatus === 'live';
  const streamLabel = isLive ? 'Live stream' : 'Waiting for ESP32';
  const riskLabel = statusFromRisk(currentAnalysis.risk);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Muscle Fatigue Overview"
        description="Live EMG and posture analysis with clear risk status for the current device."
      >
        <div
          className={`badge ${
            isLive ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${isLive ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          {streamLabel}
        </div>
        <button type="button" onClick={loadInitialData} disabled={isRefreshing} className="btn-outline">
          <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
          Refresh
        </button>
      </PageHeader>

      {loadError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Backend data could not be loaded: {loadError}.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatusCard
          title="Overall Risk"
          value={isLive ? titleCase(currentAnalysis.risk) : '--'}
          status={isLive ? riskLabel : 'Neutral'}
          icon={ShieldAlert}
          description={isLive ? `Device ${currentAnalysis.device_id}` : 'No live ESP32 packet'}
        />
        <StatusCard
          title="Muscle Fatigue"
          value={isLive ? titleCase(currentAnalysis.fatigue) : '--'}
          status={isLive ? statusFromFatigue(currentAnalysis.fatigue) : 'Neutral'}
          icon={ActivitySquare}
          description="Based on calibrated RMS ratio"
        />
        <StatusCard
          title="Posture"
          value={isLive ? titleCase(currentAnalysis.posture) : '--'}
          status={isLive ? (currentAnalysis.posture === 'good' ? 'Normal' : 'Warning') : 'Neutral'}
          icon={HeartPulse}
          description="Pitch and roll inclination"
        />
        <StatusCard
          title="Pitch / Roll"
          value={isLive ? `${formatNumber(currentAnalysis.pitch)} deg / ${formatNumber(currentAnalysis.roll)} deg` : '--'}
          status="Neutral"
          icon={BrainCircuit}
          description="Current IMU position"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="card xl:col-span-2">
          <div className="card-header">
            <div>
              <h2 className="card-title">Live EMG Activity</h2>
              <p className="mt-1 text-xs text-slate-500">Raw EMG compared with smoothed RMS values.</p>
            </div>
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <Clock className="h-4 w-4" />
              {currentAnalysis.created_at ? formatDateTime(currentAnalysis.created_at) : 'Waiting for data'}
            </div>
          </div>
          <div className="card-body min-w-0 overflow-hidden">
            <ResponsiveContainer width="100%" height={340} minWidth={0}>
              <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} width={42} />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 10px 25px -18px rgb(15 23 42 / 0.35)',
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Line
                  type="monotone"
                  name="Raw EMG"
                  dataKey="emg_raw"
                  stroke="#64748b"
                  strokeWidth={2}
                  strokeOpacity={0.55}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  name="RMS"
                  dataKey="emg_rms"
                  stroke="#2563eb"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 5, fill: '#2563eb', stroke: '#fff', strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card flex flex-col">
          <div className="card-header">
            <div>
              <h2 className="card-title">Recent Alerts</h2>
              <p className="mt-1 text-xs text-slate-500">Latest unresolved safety events.</p>
            </div>
          </div>
          <div className="min-h-[320px] flex-1 overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="flex h-full min-h-[260px] flex-col items-center justify-center px-6 text-center text-slate-500">
                <ShieldAlert className="mb-3 h-9 w-9 text-emerald-500" />
                <p className="text-sm font-semibold text-slate-800">No active alerts</p>
                <p className="mt-1 text-sm">{isLive ? 'Current readings are inside the safe range.' : 'No live hardware readings yet.'}</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {alerts.map((alert) => (
                  <div key={alert.id} className="flex items-start gap-3 p-4">
                    <div
                      className={cn(
                        'mt-0.5 rounded-lg p-2',
                        alert.level === 'Critical' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                      )}
                    >
                      <ShieldAlert className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{alert.type}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{alert.desc}</p>
                      <p className="mt-1 text-xs text-slate-400">{alert.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="border-t border-slate-100 bg-slate-50/70 p-4">
            <Link to="/alerts" className="btn-outline w-full">
              View alert history
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
