import React from 'react';

export default function Settings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">System Settings</h1>
        <p className="text-slate-500 mt-1">Configure thresholds and system preferences.</p>
      </div>
      
      <div className="card">
        <div className="card-body flex items-center justify-center min-h-[400px] text-slate-400">
          <p>Threshold configuration and user settings will be displayed here.</p>
        </div>
      </div>
    </div>
  );
}
