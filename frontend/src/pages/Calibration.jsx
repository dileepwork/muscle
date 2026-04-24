import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Play, RotateCcw, Save } from 'lucide-react';
import { requestJson } from '../lib/api';
import { formatNumber, normalizeSensorRow } from '../lib/format';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const avg  = (vals) => vals.reduce((s, v) => s + v, 0) / vals.length;

// Step indicator
function Step({ n, label, active, done }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
        style={{
          background: done ? '#166534' : active ? '#1e3a8a' : '#1f1f1f',
          border: `1px solid ${done ? '#15803d' : active ? '#2563eb' : '#2a2a2a'}`,
          color: done ? '#4ade80' : active ? '#93c5fd' : '#525252',
        }}
      >
        {done ? <CheckCircle2 className="h-4 w-4" /> : n}
      </div>
      <span className={`text-sm font-medium ${active ? 'text-neutral-100' : done ? 'text-neutral-400' : 'text-neutral-600'}`}>
        {label}
      </span>
    </div>
  );
}

// Stat box
function ValueBox({ label, value, unit = 'uV' }) {
  return (
    <div className="rounded-lg p-4" style={{ background: '#1f1f1f', border: '1px solid #2a2a2a' }}>
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold text-neutral-100">
        {value} <span className="text-sm font-normal text-neutral-500">{unit}</span>
      </p>
    </div>
  );
}

export default function Calibration() {
  const [step,        setStep]        = useState(0);
  const [deviceId,    setDeviceId]    = useState('ESP32_01');
  const [baseline,    setBaseline]    = useState(0);
  const [peak,        setPeak]        = useState(0);
  const [capturing,   setCapturing]   = useState(false);
  const [message,     setMessage]     = useState('');
  const [error,       setError]       = useState('');

  const capture = async (type) => {
    setCapturing(true); setError(''); setMessage('Sampling for 3 seconds…');
    try {
      await wait(3000);
      const rows    = await requestJson(`/api/sensor-data/latest?device_id=${encodeURIComponent(deviceId.trim())}`);
      const samples = rows.map(normalizeSensorRow);
      const rmsVals = samples.map((s) => s.emg_rms).filter(Number.isFinite);
      if (!rmsVals.length) throw new Error('No data found. Make sure the ESP32 is streaming.');

      if (type === 'baseline') {
        const low  = [...rmsVals].sort((a, b) => a - b).slice(0, Math.min(5, rmsVals.length));
        const val  = Math.max(0, Math.round(avg(low)));
        setBaseline(val); setStep(2);
        setMessage(`Baseline captured: ${val} uV (avg of ${low.length} lowest samples).`);
      } else {
        const val = Math.round(Math.max(...samples.map((s) => Math.max(s.emg_peak, s.emg_rms))));
        if (val <= baseline) throw new Error('Peak must be higher than baseline. Flex harder.');
        setPeak(val); setStep(3);
        setMessage(`Peak captured: ${val} uV.`);
      }
    } catch (e) { setError(e.message); setMessage(''); }
    finally     { setCapturing(false); }
  };

  const save = async () => {
    setError(''); setMessage('');
    if (!deviceId.trim())  { setError('Device ID is required.'); return; }
    if (peak <= baseline)  { setError('Maximum RMS must be above baseline.'); return; }
    try {
      await requestJson('/api/device/calibrate', {
        method: 'POST',
        body: JSON.stringify({ device_id: deviceId.trim(), baseline_rms: baseline, max_rms: peak }),
      });
      setMessage('Profile saved. Fatigue scoring will now use these values.');
      setStep(0);
    } catch (e) { setError(e.message); }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-base font-semibold text-neutral-100">Calibration</h1>
        <p className="mt-0.5 text-xs text-neutral-500">
          Capture your resting and maximum RMS so the fatigue engine is accurate for your body.
        </p>
      </div>

      {/* Step tracker */}
      <div className="card p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-8">
          <Step n={1} label="Prepare"        active={step === 0} done={step > 0} />
          <div className="hidden h-px flex-1 sm:block" style={{ background: '#2a2a2a' }} />
          <Step n={2} label="Relax muscle"   active={step === 1} done={step > 1} />
          <div className="hidden h-px flex-1 sm:block" style={{ background: '#2a2a2a' }} />
          <Step n={3} label="Flex maximum"   active={step === 2} done={step > 2} />
          <div className="hidden h-px flex-1 sm:block" style={{ background: '#2a2a2a' }} />
          <Step n={4} label="Review & save"  active={step === 3} done={false} />
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-start gap-2.5 rounded-lg border border-red-900 bg-red-950/60 px-4 py-3 text-sm text-red-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-lg border border-green-900 bg-green-950/60 px-4 py-3 text-sm text-green-400">
          {message}
        </div>
      )}

      {/* Main card */}
      <div className="card p-6">

        {/* Step 0 — Prepare */}
        {step === 0 && (
          <div className="space-y-5">
            <div>
              <p className="text-xs font-medium text-blue-400">Step 1 of 4</p>
              <h2 className="mt-1 text-lg font-semibold text-neutral-100">Prepare the device</h2>
              <p className="mt-1.5 text-sm text-neutral-500">
                Attach the EMG sensor firmly to the target muscle and make sure the ESP32 is actively streaming data to the backend.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="text" value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                className="input sm:w-48" placeholder="Device ID"
              />
              <button onClick={() => setStep(1)} className="btn-primary">
                <Play className="h-4 w-4" /> Begin calibration
              </button>
            </div>
          </div>
        )}

        {/* Step 1 — Relax */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <p className="text-xs font-medium text-blue-400">Step 2 of 4</p>
              <h2 className="mt-1 text-lg font-semibold text-neutral-100">Relax the muscle</h2>
              <p className="mt-1.5 text-sm text-neutral-500">
                Let your arm hang naturally. Do not flex. Click capture and hold still for 3 seconds.
              </p>
            </div>
            <button onClick={() => capture('baseline')} disabled={capturing} className="btn-primary">
              {capturing ? 'Sampling for 3 s…' : 'Capture baseline'}
            </button>
          </div>
        )}

        {/* Step 2 — Flex */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <p className="text-xs font-medium text-yellow-500">Step 3 of 4</p>
              <h2 className="mt-1 text-lg font-semibold text-neutral-100">Flex at maximum</h2>
              <p className="mt-1.5 text-sm text-neutral-500">
                Contract the muscle as hard as you can and hold it. Click capture and maintain the flex for 3 seconds.
              </p>
            </div>
            <ValueBox label="Captured baseline" value={formatNumber(baseline, 0)} />
            <button
              onClick={() => capture('peak')} disabled={capturing}
              className="h-9 inline-flex items-center gap-2 rounded-lg bg-red-700 px-4 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50"
            >
              {capturing ? 'Sampling for 3 s…' : 'Capture maximum flex'}
            </button>
          </div>
        )}

        {/* Step 3 — Review */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <p className="text-xs font-medium text-green-400">Step 4 of 4</p>
              <h2 className="mt-1 text-lg font-semibold text-neutral-100">Review & save</h2>
              <p className="mt-1.5 text-sm text-neutral-500">
                Confirm the captured values look correct, then save to apply this profile.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <ValueBox label="Baseline (relaxed)" value={formatNumber(baseline, 0)} />
              <ValueBox label="Maximum (flexed)"   value={formatNumber(peak, 0)} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="btn-outline">
                <RotateCcw className="h-4 w-4" /> Retake
              </button>
              <button onClick={save} className="btn-primary">
                <Save className="h-4 w-4" /> Save profile
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
