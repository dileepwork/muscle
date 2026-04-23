import { useState } from 'react';
import { ActivitySquare, AlertTriangle, CheckCircle2, Play, RotateCcw, Save } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { requestJson } from '../lib/api';
import { formatNumber, normalizeSensorRow } from '../lib/format';

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const average = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;

export default function Calibration() {
  const [step, setStep] = useState(0);
  const [deviceId, setDeviceId] = useState('ESP32_01');
  const [baseline, setBaseline] = useState(0);
  const [peak, setPeak] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const captureLatestSamples = async (type) => {
    setIsCapturing(true);
    setError('');
    setMessage('Capturing live backend samples for 3 seconds...');

    try {
      await wait(3000);
      const rows = await requestJson(`/api/sensor-data/latest?device_id=${encodeURIComponent(deviceId.trim())}`);
      const samples = rows.map(normalizeSensorRow);
      const rmsValues = samples.map((sample) => sample.emg_rms).filter(Number.isFinite);

      if (rmsValues.length === 0) {
        throw new Error('No RMS samples found for this device. Start the ESP32 stream first.');
      }

      if (type === 'baseline') {
        const lowestValues = [...rmsValues].sort((a, b) => a - b).slice(0, Math.min(5, rmsValues.length));
        const baselineValue = Math.max(0, Math.round(average(lowestValues)));
        setBaseline(baselineValue);
        setStep(2);
        setMessage(`Baseline captured from ${lowestValues.length} relaxed samples.`);
      } else {
        const peakValue = Math.max(...samples.map((sample) => Math.max(sample.emg_peak, sample.emg_rms)));
        const roundedPeak = Math.round(peakValue);

        if (roundedPeak <= baseline) {
          throw new Error('Peak RMS must be higher than baseline. Flex harder or retake baseline.');
        }

        setPeak(roundedPeak);
        setStep(3);
        setMessage('Peak captured from live sensor samples.');
      }
    } catch (captureError) {
      setError(captureError.message);
      setMessage('');
    } finally {
      setIsCapturing(false);
    }
  };

  const saveCalibration = async () => {
    setError('');
    setMessage('');

    if (!deviceId.trim()) {
      setError('Device ID is required.');
      return;
    }

    if (peak <= baseline) {
      setError('Maximum RMS must be higher than baseline RMS.');
      return;
    }

    try {
      await requestJson('/api/device/calibrate', {
        method: 'POST',
        body: JSON.stringify({
          device_id: deviceId.trim(),
          baseline_rms: baseline,
          max_rms: peak,
        }),
      });

      setMessage('Calibration saved. New fatigue readings will use this profile.');
      setStep(0);
    } catch (saveError) {
      setError(saveError.message);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Adaptive Calibration"
        description="Capture relaxed and maximum RMS from real device samples so fatigue scoring matches the user."
      />

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {message && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      )}

      <div className="card">
        <div className="card-body p-5 sm:p-8">
          {step === 0 && (
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[220px_1fr] lg:items-center">
              <div className="flex justify-center">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-blue-50 text-blue-600 ring-1 ring-blue-100">
                  <ActivitySquare className="h-12 w-12" />
                </div>
              </div>
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Prepare the device</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Attach the sensor firmly, start the ESP32 stream, then capture relaxed and flexed RMS values.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    type="text"
                    value={deviceId}
                    onChange={(event) => setDeviceId(event.target.value)}
                    className="input sm:w-56"
                    placeholder="Device ID"
                  />
                  <button type="button" onClick={() => setStep(1)} className="btn-primary">
                    <Play className="h-4 w-4" />
                    Start Calibration
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6 text-center">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Step 1</p>
                <h2 className="mt-1 text-2xl font-bold text-slate-900">Relax the muscle</h2>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">
                  Keep the target muscle fully relaxed and still while the backend records the latest RMS values.
                </p>
              </div>
              <button
                type="button"
                onClick={() => captureLatestSamples('baseline')}
                disabled={isCapturing}
                className="btn-primary px-6"
              >
                {isCapturing ? 'Capturing...' : 'Capture Baseline'}
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 text-center">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-red-600">Step 2</p>
                <h2 className="mt-1 text-2xl font-bold text-slate-900">Flex maximum</h2>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">
                  Contract the muscle firmly and hold it steady for the capture window.
                </p>
              </div>
              <div className="mx-auto max-w-xs rounded-lg border border-slate-200 bg-slate-50 p-4 text-left">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Captured baseline</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{formatNumber(baseline, 0)} uV</p>
              </div>
              <button
                type="button"
                onClick={() => captureLatestSamples('peak')}
                disabled={isCapturing}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-red-600 px-6 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-700 disabled:bg-slate-300"
              >
                {isCapturing ? 'Capturing...' : 'Capture Maximum'}
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Calibration ready</h2>
                <p className="mt-2 text-sm text-slate-600">Review the captured profile before saving.</p>
              </div>

              <div className="mx-auto grid max-w-md grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-left">
                  <p className="text-sm text-slate-500">Baseline RMS</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{formatNumber(baseline, 0)} uV</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-left">
                  <p className="text-sm text-slate-500">Maximum RMS</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{formatNumber(peak, 0)} uV</p>
                </div>
              </div>

              <div className="flex flex-col justify-center gap-3 sm:flex-row">
                <button type="button" onClick={() => setStep(1)} className="btn-outline">
                  <RotateCcw className="h-4 w-4" />
                  Retake
                </button>
                <button type="button" onClick={saveCalibration} className="btn-primary">
                  <Save className="h-4 w-4" />
                  Save Profile
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
