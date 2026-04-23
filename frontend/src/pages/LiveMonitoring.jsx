import React from 'react';

export default function LiveMonitoring() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Live Monitoring</h1>
        <p className="text-slate-500 mt-1">Detailed real-time view of sensor data.</p>
      </div>
      
      <div className="card">
        <div className="card-body flex items-center justify-center min-h-[400px] text-slate-400 flex-col gap-4">
          <p>Live Monitoring interface will connect to WebSocket or poll backend API.</p>
          <p className="text-sm">Hardware team should send data to <code className="bg-slate-100 text-slate-800 px-2 py-1 rounded">POST /api/sensor-data</code></p>
        </div>
      </div>
    </div>
  );
}
