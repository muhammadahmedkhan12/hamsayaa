import React from 'react';

export default function Settings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Society Settings & Configuration</h1>
        <p className="text-sm text-slate-500">Configure per-unit rates, default society bank accounts, overstay parameters, and Gemini API guardrails.</p>
      </div>

      <div className="bg-white border border-surface-border rounded-lg p-6 shadow-sm">
        <p className="text-sm text-slate-600">Society configuration forms will be managed here.</p>
      </div>
    </div>
  );
}
