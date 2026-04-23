import React from 'react';

export default function History() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">History Logs</h1>
        <p className="text-slate-500 mt-1">Review past monitoring sessions and data trends.</p>
      </div>
      
      <div className="card">
        <div className="card-body flex items-center justify-center min-h-[400px] text-slate-400">
          <p>History table and historical charts will be displayed here.</p>
        </div>
      </div>
    </div>
  );
}
