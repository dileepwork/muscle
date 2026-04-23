import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Clock, Radio, RefreshCw, Zap } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { io } from 'socket.io-client';
import PageHeader from '../components/PageHeader';
import StatusCard from '../components/StatusCard';
import { API_URL, requestJson } from '../lib/api';
import { formatDateTime, formatNumber, normalizeSensorRow, riskStatus, titleCase } from '../lib/format';

const DEVICE_ID = 'ESP32_01';
const DEFAULT_MAX_RMS = 120;
const LIVE_SAMPLE_MAX_AGE_MS = 15000;
const MIN_VISIBLE_RMS = 12;
const MIN_VISIBLE_RAW = 450;

const createEmptyChartData = () =>
  Array.from({ length: 24 }, (_, index) => ({
    time: `-${23 - index}s`,
    rms: 0,
  }));

const initialAnalysis = {
  device_id: DEVICE_ID,
  fatigue: 'low',
  posture: 'good',
  risk: 'normal',
  emg_raw: 0,
  emg_rms: 0,
  emg_peak: 0,
  pitch: 0,
  roll: 0,
  created_at: null,
};

const toChartPoint = (sample) => ({
  time:
    sample.time ||
    new Date(sample.created_at || Date.now()).toLocaleTimeString([], {
      hour12: false,
      minute: '2-digit',
      second: '2-digit',
    }),
  rms: Math.max(0, sample.emg_rms),
});

const isLiveSample = (sample) => {
  const createdAt = new Date(sample.created_at || 0).getTime();
  return Number.isFinite(createdAt) && Date.now() - createdAt <= LIVE_SAMPLE_MAX_AGE_MS;
};

const isUsableSample = (sample) => isLiveSample(sample) && sample.emg_rms >= MIN_VISIBLE_RMS && sample.emg_raw >= MIN_VISIBLE_RAW;

const signalTone = (isLive, risk) => {
  if (!isLive) {
    return {
      label: 'No valid probe signal',
      status: 'Neutral',
      className: 'border-slate-200 bg-white text-slate-700',
      icon: Radio,
    };
  }

  const status = riskStatus(risk);
  if (status === 'risk') {
    return {
      label: 'High risk',
      status: 'Risk',
      className: 'border-red-200 bg-red-50 text-red-700',
      icon: AlertTriangle,
    };
  }

  if (status === 'warning') {
    return {
      label: 'Watch signal',
      status: 'Warning',
      className: 'border-amber-200 bg-amber-50 text-amber-700',
      icon: AlertTriangle,
    };
  }

  return {
    label: 'Live signal',
    status: 'Normal',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    icon: CheckCircle2,
  };
};

export default function Dashboard() {
  const [data, setData] = useState(createEmptyChartData);
  const [streamStatus, setStreamStatus] = useState('waiting');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [maxRms, setMaxRms] = useState(DEFAULT_MAX_RMS);
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
      const [latestRows, calibration] = await Promise.all([
        requestJson(`/api/sensor-data/latest?device_id=${encodeURIComponent(DEVICE_ID)}`),
        requestJson(`/api/device/calibration/${encodeURIComponent(DEVICE_ID)}`).catch(() => ({ max_rms: DEFAULT_MAX_RMS })),
      ]);

      const nextMaxRms = Number(calibration?.max_rms);
      setMaxRms(Number.isFinite(nextMaxRms) && nextMaxRms > 0 ? nextMaxRms : DEFAULT_MAX_RMS);

      const samples = latestRows.map(normalizeSensorRow).filter(isUsableSample).reverse();
      if (samples.length) {
        const latestSample = samples[samples.length - 1];
        const padded = [...createEmptyChartData(), ...samples.map(toChartPoint)].slice(-24);
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
      pushSample(normalizeSensorRow(payload));
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
  const tone = signalTone(isLive, currentAnalysis.risk);
  const ToneIcon = tone.icon;
  const effortPercent = useMemo(() => {
    if (!isLive) return 0;
    return Math.min(100, Math.round((currentAnalysis.emg_rms / maxRms) * 100));
  }, [currentAnalysis.emg_rms, isLive, maxRms]);

  const lastSeen = currentAnalysis.created_at ? formatDateTime(currentAnalysis.created_at) : 'Waiting';

  return (
    <div className="space-y-5">
      <PageHeader title="EMG Monitor" description="Live ESP32 muscle signal for the active device.">
        <div className={`badge ${tone.className}`}>
          <span className={`h-2 w-2 rounded-full ${isLive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
          {tone.label}
        </div>
        <button type="button" onClick={loadInitialData} disabled={isRefreshing} className="btn-outline">
          <RefreshCw className={isRefreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          Refresh
        </button>
      </PageHeader>

      {loadError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Backend data could not be loaded: {loadError}.
        </div>
      )}

      <section className={`rounded-lg border p-5 shadow-sm ${tone.className}`}>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-current/20 bg-white/70">
              <ToneIcon className="h-7 w-7" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold uppercase tracking-wide opacity-75">Current State</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">{tone.label}</h1>
              <p className="mt-1 text-sm opacity-80">{isLive ? `Last packet ${lastSeen}` : 'Waiting for a clean EMG packet.'}</p>
            </div>
          </div>

          <div className="min-w-[130px] rounded-lg border border-current/20 bg-white/75 px-4 py-3 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide opacity-70">Effort</p>
            <p className="mt-1 text-4xl font-bold text-slate-950">{isLive ? `${effortPercent}%` : '--'}</p>
          </div>
        </div>
        <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/70">
          <div
            className={`h-full rounded-full transition-all ${
              riskStatus(currentAnalysis.risk) === 'risk'
                ? 'bg-red-600'
                : riskStatus(currentAnalysis.risk) === 'warning'
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
            }`}
            style={{ width: `${effortPercent}%` }}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatusCard
          title="RMS Signal"
          value={isLive ? formatNumber(currentAnalysis.emg_rms) : '--'}
          status={tone.status}
          icon={Activity}
          description="Filtered muscle activity"
        />
        <StatusCard
          title="Peak ADC"
          value={isLive ? formatNumber(currentAnalysis.emg_peak, 0) : '--'}
          status="Neutral"
          icon={Radio}
          description="Highest recent analog value"
        />
        <StatusCard
          title="Raw ADC"
          value={isLive ? formatNumber(currentAnalysis.emg_raw, 0) : '--'}
          status="Neutral"
          icon={Zap}
          description={`Device ${currentAnalysis.device_id || DEVICE_ID}`}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">RMS Activity</h2>
              <p className="mt-1 text-xs text-slate-500">Recent valid RMS signal.</p>
            </div>
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <Clock className="h-4 w-4" />
              {lastSeen}
            </div>
          </div>
          <div className="card-body min-w-0 overflow-hidden">
            <ResponsiveContainer width="100%" height={320} minWidth={0}>
              <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                <defs>
                  <linearGradient id="rmsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0f766e" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#0f766e" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  width={42}
                  domain={[0, (dataMax) => Math.max(40, Math.ceil(dataMax + 10))]}
                />
                <Tooltip
                  formatter={(value) => [formatNumber(value), 'RMS']}
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 10px 25px -18px rgb(15 23 42 / 0.35)',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="rms"
                  stroke="#0f766e"
                  strokeWidth={3}
                  fill="url(#rmsFill)"
                  dot={false}
                  activeDot={{ r: 5, fill: '#0f766e', stroke: '#fff', strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Last Packet</h2>
              <p className="mt-1 text-xs text-slate-500">Active stream details.</p>
            </div>
          </div>
          <div className="card-body space-y-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Risk</span>
              <span className={`badge ${tone.className}`}>{isLive ? titleCase(currentAnalysis.risk) : '--'}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Fatigue</span>
              <span className="font-semibold text-slate-900">{isLive ? titleCase(currentAnalysis.fatigue) : '--'}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Posture</span>
              <span className="font-semibold text-slate-900">{isLive ? titleCase(currentAnalysis.posture) : '--'}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Pitch / Roll</span>
              <span className="font-semibold text-slate-900">
                {isLive ? `${formatNumber(currentAnalysis.pitch)} / ${formatNumber(currentAnalysis.roll)} deg` : '--'}
              </span>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Calibration Max RMS</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{formatNumber(maxRms, 0)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
