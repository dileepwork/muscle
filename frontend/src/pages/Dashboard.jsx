import React, { useState, useEffect, useRef } from 'react';
import { Activity, Battery, ShieldAlert, ActivitySquare, BrainCircuit, HeartPulse } from 'lucide-react';
import StatusCard from '../components/StatusCard';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { io } from 'socket.io-client';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export default function Dashboard() {
  const [data, setData] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState({
    fatigue: 'low',
    posture: 'good',
    risk: 'normal',
    pitch: 0,
    roll: 0
  });

  const lastUpdateRef = useRef(Date.now());
  const socketRef = useRef(null);

  useEffect(() => {
    // Fill initial empty chart
    const initialData = Array.from({ length: 20 }).map((_, i) => ({
      time: new Date(Date.now() - (19 - i) * 1000).toLocaleTimeString([], { hour12: false, second: '2-digit', minute: '2-digit' }),
      emg_raw: 0,
      emg_rms: 0,
    }));
    setData(initialData);

    // 1. Connect WebSocket
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
    socketRef.current = io(backendUrl);
    
    socketRef.current.on('connect', () => {
      console.log('Connected to WebSocket server');
    });

    socketRef.current.on('sensor_update', (payload) => {
      lastUpdateRef.current = Date.now();
      setIsDemoMode(false);

      // Update charts
      setData(prev => {
        const newData = [...prev.slice(1)];
        newData.push({
          time: payload.time || new Date().toLocaleTimeString([], { hour12: false, second: '2-digit', minute: '2-digit' }),
          emg_raw: payload.emg_raw,
          emg_rms: payload.emg_rms,
        });
        return newData;
      });

      // Update status cards
      setCurrentAnalysis({
        fatigue: payload.fatigue,
        posture: payload.posture,
        risk: payload.risk,
        pitch: payload.pitch,
        roll: payload.roll
      });

      // Append alert if warning or critical
      if (payload.risk === 'warning' || payload.risk === 'critical') {
        setAlerts(prev => {
          const newAlert = {
            time: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' }),
            type: payload.risk === 'critical' ? 'Critical Risk Detected' : 'Safety Warning',
            desc: `Fatigue: ${payload.fatigue}, Posture: ${payload.posture}`,
            level: payload.risk === 'critical' ? 'Risk' : 'Warning'
          };
          // keep last 10 alerts max
          return [newAlert, ...prev].slice(0, 10);
        });
      }
    });

    // 2. Fallback Demo Mode Watchdog
    let timeOffset = 0;
    const watchdogInterval = setInterval(() => {
      if (Date.now() - lastUpdateRef.current > 3000) {
        setIsDemoMode(true);
        
        // Generate simulated data since no hardware is streaming
        timeOffset += 0.1;
        const raw = Math.floor(Math.random() * 300) + 150;
        const rms = raw * 0.707 + Math.random() * 20;
        const simulatedPitch = Math.sin(timeOffset) * 15;
        const simulatedRoll = Math.cos(timeOffset) * 10;
        
        let newFatigue = 'low';
        let newPosture = 'good';
        let newRisk = 'normal';

        if (Math.abs(simulatedPitch) > 10) newPosture = 'bad';
        if (Math.random() > 0.95) newFatigue = 'moderate';
        if (newPosture === 'bad' && newFatigue === 'moderate') newRisk = 'warning';

        setData(prev => {
          const newData = [...prev.slice(1)];
          newData.push({
            time: new Date().toLocaleTimeString([], { hour12: false, second: '2-digit', minute: '2-digit' }),
            emg_raw: raw,
            emg_rms: rms,
          });
          return newData;
        });

        setCurrentAnalysis({
          fatigue: newFatigue,
          posture: newPosture,
          risk: newRisk,
          pitch: simulatedPitch.toFixed(1),
          roll: simulatedRoll.toFixed(1)
        });
      }
    }, 1000);

    return () => {
      clearInterval(watchdogInterval);
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Intelligent Monitoring Overview</h1>
          <p className="text-slate-500 mt-1">Real-time processed sensor data, posture tracking, and adaptive fatigue analysis.</p>
        </div>
        {isDemoMode && (
          <div className="bg-amber-100 text-amber-700 px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            Demo Mode Active (No Hardware Connected)
          </div>
        )}
      </div>

      {/* Top Status Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatusCard 
          title="Overall Risk Level" 
          value={currentAnalysis.risk.toUpperCase()} 
          status={currentAnalysis.risk === 'normal' ? 'Normal' : currentAnalysis.risk === 'warning' ? 'Warning' : 'Risk'}
          icon={ShieldAlert}
          description="Combined IMU & EMG analysis"
        />
        <StatusCard 
          title="Muscle Fatigue" 
          value={currentAnalysis.fatigue.toUpperCase()} 
          status={currentAnalysis.fatigue === 'low' ? 'Normal' : 'Warning'}
          icon={ActivitySquare}
          description="Derived from Adaptive RMS"
        />
        <StatusCard 
          title="Posture Status" 
          value={currentAnalysis.posture.toUpperCase()} 
          status={currentAnalysis.posture === 'good' ? 'Normal' : 'Warning'}
          icon={HeartPulse}
          description="Pitch & Roll inclination analysis"
        />
        <StatusCard 
          title="Live Pitch / Roll" 
          value={`${currentAnalysis.pitch}° / ${currentAnalysis.roll}°`} 
          status="Neutral"
          icon={BrainCircuit}
          description="IMU tracking in real-time"
        />
      </div>

      {/* Main Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-2">
          <div className="card-header">
            <div className="flex flex-col">
              <h2 className="card-title">Live EMG Activity (Raw vs RMS)</h2>
              <p className="text-xs text-slate-500 mt-1">Processed natively on ESP32 device</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className={cn("absolute inline-flex h-full w-full rounded-full opacity-75", isDemoMode ? "bg-amber-400" : "bg-emerald-400 animate-ping")}></span>
                <span className={cn("relative inline-flex rounded-full h-3 w-3", isDemoMode ? "bg-amber-500" : "bg-emerald-500")}></span>
              </span>
              <span className="text-sm text-slate-500 font-medium">{isDemoMode ? 'Simulating' : 'Streaming Live'}</span>
            </div>
          </div>
          <div className="card-body h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}/>
                <Line 
                  type="monotone" 
                  name="Raw EMG (µV)"
                  dataKey="emg_raw" 
                  stroke="#94a3b8" 
                  strokeWidth={2}
                  strokeOpacity={0.5}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line 
                  type="monotone" 
                  name="EMG RMS (µV)"
                  dataKey="emg_rms" 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 6, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }} 
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Alerts & Insights Panel */}
        <div className="card flex flex-col">
          <div className="card-header">
            <h2 className="card-title">Live Alerts Timeline</h2>
          </div>
          <div className="card-body p-0 flex-1 overflow-y-auto min-h-[350px]">
            <div className="divide-y divide-slate-100">
              
              {alerts.length === 0 && currentAnalysis.risk === 'normal' && (
                <div className="p-8 text-center text-slate-400">
                  <ShieldAlert className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No recent alerts.</p>
                  <p className="text-xs">System is operating normally.</p>
                </div>
              )}

              {alerts.map((alert, i) => (
                <div key={i} className="p-4 hover:bg-slate-50 transition-colors flex items-start gap-4 animate-in fade-in slide-in-from-top-2">
                  <div className={cn(
                    "p-2 rounded-full mt-1",
                    alert.level === 'Risk' ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"
                  )}>
                    <ShieldAlert className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{alert.type}</p>
                    <p className="text-xs text-slate-500 mt-1">{alert.desc}</p>
                    <p className="text-xs text-slate-400 mt-1">{alert.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="p-4 border-t border-slate-100 bg-slate-50/50 mt-auto">
            <button className="text-sm font-medium text-blue-600 hover:text-blue-700 w-full text-center">
              View alert history
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
