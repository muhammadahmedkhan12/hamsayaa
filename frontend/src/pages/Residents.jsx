import React from 'react';

export default function Residents() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-navy">Residents & Units Directory</h1>
          <p className="text-sm text-slate-500">Manage society residents, toggle WhatsApp access block, and bulk import rosters.</p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-navy text-white text-sm font-medium rounded-lg shadow-sm">
            + Add Resident
          </button>
        </div>
      </div>

      <div className="bg-white border border-surface-border rounded-lg p-6 shadow-sm">
        <p className="text-sm text-slate-600">Resident roster and vehicle list view will be populated here.</p>
      </div>
    </div>
  );
}
