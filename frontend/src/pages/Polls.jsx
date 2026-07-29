import React from 'react';

export default function Polls() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Polls & Digital Voting</h1>
        <p className="text-sm text-slate-500">Create WhatsApp community polls and auto-export PDF/Excel voting reports upon expiry.</p>
      </div>

      <div className="bg-white border border-surface-border rounded-lg p-6 shadow-sm">
        <p className="text-sm text-slate-600">Active and expired community polls will be displayed here.</p>
      </div>
    </div>
  );
}
