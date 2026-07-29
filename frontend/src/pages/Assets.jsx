import React from 'react';

export default function Assets() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Asset Directory & Maintenance</h1>
        <p className="text-sm text-slate-500">Track society assets (generators, lifts, pumps) and record service logs.</p>
      </div>

      <div className="bg-white border border-surface-border rounded-lg p-6 shadow-sm">
        <p className="text-sm text-slate-600">Asset directory and maintenance records will be displayed here.</p>
      </div>
    </div>
  );
}
