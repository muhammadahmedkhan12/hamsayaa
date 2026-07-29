import React from 'react';

export default function Amenities() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Amenities & Facilities Info</h1>
        <p className="text-sm text-slate-500">Configure timings, rules, and capacities for gym, hall, and community facilities (retrieved by WhatsApp bot).</p>
      </div>

      <div className="bg-white border border-surface-border rounded-lg p-6 shadow-sm">
        <p className="text-sm text-slate-600">Amenity details will be configured here.</p>
      </div>
    </div>
  );
}
