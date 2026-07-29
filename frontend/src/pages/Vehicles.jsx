import React from 'react';

export default function Vehicles() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-navy">Gate & Vehicle Entry Logs</h1>
          <p className="text-sm text-slate-500">Log vehicle entries, track unregistered visitor overstays (0-min grace), and bulk import entrance records.</p>
        </div>
      </div>

      <div className="bg-white border border-surface-border rounded-lg p-6 shadow-sm">
        <p className="text-sm text-slate-600">Vehicle entrance and overstay log data will be managed here.</p>
      </div>
    </div>
  );
}
