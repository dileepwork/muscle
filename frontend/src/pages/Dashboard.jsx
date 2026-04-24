import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Clock, RefreshCw, Wifi, WifiOff, Zap } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { io } from 'socket.io-client';
import { API_URL, requestJson } from '../lib/api';
import { formatDateTime, formatNumber, normalizeSensorRow, riskStatus, titleCase } from '../lib/format';

const DEVICE_ID       = 'ESP32_01';
const DEFAULT_MAX_RMS = 120;
const LIVE_AGE_MS     = 15000;

const emptyChart = () =>
  Array.from({ length: 30 }, (_, i) => ({ time: `-${29 - i}s`, rms: 0 }));

const toPoint = (s) => ({
  time: s.time || new Date(s.created_at || Date.now()).toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' }),
  rms:  Math.max(0, s.emg_rms),
});

const isLive = (s) => {
  const ms = new Date(s.created_at || 0).getTime();
  return Number.isFinite(ms) && Date.now() - ms <= LIVE_AGE_MS;
};

const blank = { device_id: DEVICE_ID, fatigue: 'low', posture: 'good', risk: 'normal', emg_raw: 0, emg_rms: 0, emg_peak: 0, pitch: 0, roll: 0, created_at: null };

function StatCard({ label, value, sub }) {
  return (
    <div className="card p-5">
      <p className="text-xs font-medium text-neutral-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-neutral-100">{value}</p>
      {sub && <p className="mt-1 text-xs text-neutral-600">{sub}</p>}
    </div>
  );
}

function Row({ label, value, accent }) {
  return (
    <div className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid #1f1f1f' }}>
      <span className="text-sm text-neutral-400">{label}</span>
      <span className={`text-sm font-medium ${accent || 'text-neutral-200'}`}>{value}</span>
    </div>
  );
}

export default function Dashboard() {
  const [chart, setChart]       = useState(emptyChart);
  const [status, setStatus]     = useState('waiting'); // waiting | live
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState('');
  const [maxRms, setMaxRms]     = useState(DEFAULT_MAX_RMS);
  const [data, setData]         = useState(blank);
  const sockRef = useRef(null);
  const lastRef = useRef(0);

  const push = useCallback((s) => {
    lastRef.current = Date.now();
    setStatus('live');
    setChart((p) => [...p.slice(1), toPoint(s)]);
    setData(s);
  }, []);

  const load = useCallback(async () => {
    setBusy(true); setError('');
    try {
      const [rows, cal] = await Promise.all([
        requestJson(`/api/sensor-data/latest?device_id=${encodeURIComponent(DEVICE_ID)}`),
        requestJson(`/api/device/calibration/${encodeURIComponent(DEVICE_ID)}`).catch(() => ({ max_rms: DEFAULT_MAX_RMS })),
      ]);
      const n = Number(cal?.max_rms);
      setMaxRms(Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_RMS);
      const samples = rows.map(normalizeSensorRow).filter(isLive).reverse();
      if (samples.length) {
        setChart([...emptyChart(), ...samples.map(toPoint)].slice(-30));
        setData(samples[samples.length - 1]);
        lastRef.current = Date.now();
        setStatus('live');
      } else {
        setChart(emptyChart()); setData(blank); lastRef.current = 0; setStatus('waiting');
      }
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    sockRef.current = io(API_URL, { reconnectionAttempts: 3, timeout: 3000 });
    sockRef.current.on('sensor_update', (p) => push(normalizeSensorRow(p)));

    const interval = setInterval(() => {
      if (!lastRef.current || Date.now() - lastRef.current <= LIVE_AGE_MS) return;
      lastRef.current = 0; setStatus('waiting'); setData(blank); setChart(emptyChart());
    }, 1000);

    return () => { clearTimeout(t); clearInterval(interval); sockRef.current?.disconnect(); };
  }, [load, push]);

  const live   = status === 'live';
  const effort = useMemo(() => live ? Math.min(100, Math.round((data.emg_rms / maxRms) * 100)) : 0, [data.emg_rms, live, maxRms]);
  const rs     = riskStatus(data.risk);
  const lastSeen = data.created_at ? formatDateTime(data.created_at) : '—';

  // status banner colors
  const bannerColor = rs === 'risk' ? '#ef4444' : rs === 'warning' ? '#f59e0b' : '#22c55e';
  const bannerText  = rs === 'risk' ? 'Critical' : rs === 'warning' ? 'Warning' : live ? 'Normal' : 'No signal';
  const BannerIcon  = rs === 'risk' || rs === 'warning' ? AlertTriangle : live ? CheckCircle2 : WifiOff;

  // chart line color
  const chartColor = effort >= 75 ? '#ef4444' : effort >= 25 ? '#3b82f6' : '#525252';

  return (
    <div className="space-y-5">

      {/* ── Page title row ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-neutral-100">EMG Monitor</h1>
          <p className="text-xs text-neutral-500">Device: {DEVICE_ID} · Max calibrated RMS: {formatNumber(maxRms, 0)} uV</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${live ? 'border-green-900 bg-green-950 text-green-400' : 'border-neutral-800 bg-neutral-900 text-neutral-500'}`}>
            {live ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {live ? 'Live' : 'Waiting'}
          </span>
          <button onClick={load} disabled={busy} className="btn-outline">
            <RefreshCw className={busy ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-900 bg-red-950/50 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* ── Status banner ── */}
      <div
        className="flex items-center justify-between rounded-xl p-5"
        style={{ background: '#171717', border: '1px solid #262626' }}
      >
        <div className="flex items-center gap-4">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
            style={{ background: `${bannerColor}18`, border: `1px solid ${bannerColor}44` }}
          >
            <BannerIcon className="h-5 w-5" style={{ color: bannerColor }} />
          </div>
          <div>
            <p className="text-xs font-medium text-neutral-500">Status</p>
            <p className="text-xl font-semibold text-neutral-100">{bannerText}</p>
          </div>
        </div>

        {/* Effort pill */}
        <div className="text-right">
          <p className="text-xs font-medium text-neutral-500">Effort</p>
          <p className="text-2xl font-semibold" style={{ color: live ? bannerColor : '#525252' }}>
            {live ? `${effort}%` : '—'}
          </p>
        </div>
      </div>

      {/* Effort bar */}
      <div>
        <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: '#262626' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${effort}%`, background: bannerColor }}
          />
        </div>
        <div className="mt-1 flex justify-between text-xs text-neutral-600">
          <span>Rest (0–24%)</span><span>Active (25–74%)</span><span>Max (75–100%)</span>
        </div>
      </div>

      {/* ── 3 stat cards ── */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="RMS Signal" value={live ? `${formatNumber(data.emg_rms)} uV` : '—'} sub="Filtered muscle activity" />
        <StatCard label="Peak ADC"   value={live ? formatNumber(data.emg_peak, 0)       : '—'} sub="Highest recent reading"  />
        <StatCard label="Raw ADC"    value={live ? formatNumber(data.emg_raw, 0)         : '—'} sub="Unfiltered ADC value"    />
      </div>

      {/* ── Chart + Analysis ── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_260px]">

        {/* Chart */}
        <div className="card">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-neutral-500" />
              <span className="card-title">Live RMS</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-neutral-500">
              <Clock className="h-3.5 w-3.5" />
              {lastSeen}
            </div>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chart} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={chartColor} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={chartColor} stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1f1f1f" />
                <XAxis dataKey="time" stroke="#404040" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#404040" fontSize={11} tickLine={false} axisLine={false} width={40}
                  domain={[0, (m) => Math.max(50, Math.ceil(m * 1.2))]} />
                <Tooltip
                  formatter={(v) => [`${formatNumber(v)} uV`, 'RMS']}
                  contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, color: '#e5e5e5', fontSize: 12 }}
                  itemStyle={{ color: chartColor }}
                />
                <Area type="monotone" dataKey="rms"
                  stroke={chartColor} strokeWidth={2}
                  fill="url(#g)" dot={false}
                  activeDot={{ r: 4, fill: chartColor, stroke: '#0f0f0f', strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Analysis panel */}
        <div className="card">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-neutral-500" />
              <span className="card-title">Analysis</span>
            </div>
          </div>
          <div className="card-body pt-2">
            <Row label="Risk"    value={live ? titleCase(data.risk)    : '—'} accent={rs === 'risk' ? 'text-red-400' : rs === 'warning' ? 'text-yellow-400' : 'text-green-400'} />
            <Row label="Fatigue" value={live ? titleCase(data.fatigue) : '—'} accent={data.fatigue === 'high' ? 'text-red-400' : data.fatigue === 'moderate' ? 'text-yellow-400' : 'text-green-400'} />
            <Row label="Posture" value={live ? titleCase(data.posture) : '—'} accent={data.posture === 'good' ? 'text-green-400' : 'text-yellow-400'} />
            <Row label="Pitch"   value={live ? `${formatNumber(data.pitch)}°` : '—'} />
            <Row label="Roll"    value={live ? `${formatNumber(data.roll)}°`  : '—'} />
            <div className="pt-3">
              <p className="mb-2 text-xs text-neutral-500">Fatigue level</p>
              <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: '#262626' }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: live ? (data.fatigue === 'high' ? '90%' : data.fatigue === 'moderate' ? '50%' : '12%') : '0%',
                    background: data.fatigue === 'high' ? '#ef4444' : data.fatigue === 'moderate' ? '#f59e0b' : '#22c55e',
                  }}
                />
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
