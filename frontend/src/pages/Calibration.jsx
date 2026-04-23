import React, { useState } from 'react';
import { ActivitySquare, Play, CheckCircle2, RotateCcw } from 'lucide-react';
import axios from 'axios';

export default function Calibration() {
  const [step, setStep] = useState(0); // 0: Start, 1: Baseline, 2: Peak, 3: Complete
  const [deviceId, setDeviceId] = useState('ESP32_01');
  const [baseline, setBaseline] = useState(0);
  const [peak, setPeak] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);

  const simulateCapture = (type) => {
    setIsCapturing(true);
    setTimeout(() => {
      setIsCapturing(false);
      if (type === 'baseline') {
        setBaseline(Math.floor(Math.random() * 20) + 10); // low RMS for relax
        setStep(2);
      } else {
        setPeak(Math.floor(Math.random() * 200) + 300); // high RMS for flex
        setStep(3);
      }
    }, 3000); // 3 seconds capture phase
  };

  const saveCalibration = async () => {
    try {
      await axios.post('http://localhost:5000/api/device/calibrate', {
        device_id: deviceId,
        baseline_rms: baseline,
        max_rms: peak
      });
      alert('Calibration saved successfully! The Risk Engine is now adapted to your muscle strength.');
      setStep(0); // Reset or redirect
    } catch (err) {
      alert('Error saving calibration. Is the backend running?');
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="text-center mt-10">
        <h1 className="text-3xl font-bold text-slate-800">Adaptive Device Calibration</h1>
        <p className="text-slate-500 mt-2">Personalize the risk detection engine to your specific muscle baseline and peak strength.</p>
      </div>
      
      <div className="card p-8 text-center mt-8">
        
        {step === 0 && (
          <div className="space-y-6">
            <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto">
              <ActivitySquare className="h-10 w-10" />
            </div>
            <h2 className="text-xl font-semibold">Ready to Calibrate?</h2>
            <p className="text-slate-500 max-w-md mx-auto">Make sure the device is firmly attached to the target muscle. The process takes less than 10 seconds.</p>
            <div className="flex justify-center gap-4">
              <input 
                type="text" 
                value={deviceId} 
                onChange={(e) => setDeviceId(e.target.value)} 
                className="border border-slate-200 rounded-lg px-4 py-2"
                placeholder="Device ID"
              />
              <button onClick={() => setStep(1)} className="btn-primary flex items-center gap-2">
                <Play className="w-4 h-4" /> Start Calibration
              </button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-blue-600">Step 1: Relax</h2>
            <p className="text-slate-600 text-lg">Completely relax your muscle and stay still.</p>
            
            {isCapturing ? (
              <div className="animate-pulse flex flex-col items-center">
                <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-4 font-medium text-slate-500">Capturing Baseline RMS...</p>
              </div>
            ) : (
              <button onClick={() => simulateCapture('baseline')} className="btn-primary px-8 py-3 text-lg">
                Begin Capture
              </button>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-red-600">Step 2: Flex Maximum</h2>
            <p className="text-slate-600 text-lg">Contract your muscle as hard as you can and hold.</p>
            
            {isCapturing ? (
              <div className="animate-pulse flex flex-col items-center">
                <div className="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-4 font-medium text-slate-500">Capturing Peak RMS...</p>
              </div>
            ) : (
              <button onClick={() => simulateCapture('peak')} className="bg-red-500 text-white px-8 py-3 rounded-lg font-medium shadow-sm hover:bg-red-600 transition-colors">
                Begin Capture
              </button>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <h2 className="text-2xl font-bold text-emerald-600">Calibration Complete</h2>
            
            <div className="grid grid-cols-2 gap-4 max-w-md mx-auto text-left">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                <p className="text-sm text-slate-500">Baseline RMS</p>
                <p className="text-2xl font-bold text-slate-800">{baseline} µV</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                <p className="text-sm text-slate-500">Maximum RMS</p>
                <p className="text-2xl font-bold text-slate-800">{peak} µV</p>
              </div>
            </div>

            <div className="flex justify-center gap-4 mt-6">
              <button onClick={() => setStep(1)} className="btn-outline flex items-center gap-2">
                <RotateCcw className="w-4 h-4" /> Retake
              </button>
              <button onClick={saveCalibration} className="btn-primary">
                Save Profile
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
