import React from 'react';

export default function Invoices() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-navy">Dues & Cumulative Invoices</h1>
          <p className="text-sm text-slate-500">Track monthly maintenance fees, utility charges, editable resident invoices, and Hamsayaa society bills.</p>
        </div>
        <button className="px-4 py-2 bg-navy text-white text-sm font-medium rounded-lg">
          Generate Cycle Invoices
        </button>
      </div>

      <div className="bg-white border border-surface-border rounded-lg p-6 shadow-sm">
        <p className="text-sm text-slate-600">Financial ledger and invoice records will be displayed here.</p>
      </div>
    </div>
  );
}
