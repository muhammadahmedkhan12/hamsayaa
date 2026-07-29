import React from 'react';

export default function Employees() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Employee Directory</h1>
        <p className="text-sm text-slate-500">Record gate guards, building supervisors, and maintenance staff (read/write directory; employees have no login access).</p>
      </div>

      <div className="bg-white border border-surface-border rounded-lg p-6 shadow-sm">
        <p className="text-sm text-slate-600">Employee records will be listed here.</p>
      </div>
    </div>
  );
}
