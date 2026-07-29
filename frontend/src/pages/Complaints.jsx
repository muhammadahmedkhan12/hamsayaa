import React from 'react';

export default function Complaints() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Tickets & Complaints</h1>
        <p className="text-sm text-slate-500">View resident complaints parsed by Gemini AI or tagged for human review.</p>
      </div>

      <div className="bg-white border border-surface-border rounded-lg p-6 shadow-sm">
        <p className="text-sm text-slate-600">Complaint tracking table will be listed here.</p>
      </div>
    </div>
  );
}
