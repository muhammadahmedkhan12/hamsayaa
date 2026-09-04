import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Eye,
  Building,
  DollarSign,
  FileText,
  X,
  ExternalLink,
  ShieldCheck,
  Percent,
  Check,
  Shield,
  Trash2,
  Droplets,
  Zap,
  Wrench
} from 'lucide-react';
import { mockInvoices, mockBuildings } from '../services/mockData';
import { fetchInvoices, generateCycleInvoicesApi, verifyInvoiceReceiptApi, payInvoiceApi } from '../services/api';

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedBuilding, setSelectedBuilding] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Modals
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [payingInvoiceId, setPayingInvoiceId] = useState(null);

  // Society Standard Voucher Template State
  const [voucherForm, setVoucherForm] = useState({
    guard_fee: 2500,
    sweeper_fee: 1000,
    water_fee: 1500,
    generator_fee: 1000,
    misc_fee: 500,
    due_date: '2026-09-15',
    account_shown: 'Meezan Bank - A/C 01020304050607 - Lakeview Maint Account',
  });

  // Calculate total voucher amount dynamically
  const totalMaintenanceFee =
    (parseFloat(voucherForm.guard_fee) || 0) +
    (parseFloat(voucherForm.sweeper_fee) || 0) +
    (parseFloat(voucherForm.water_fee) || 0) +
    (parseFloat(voucherForm.generator_fee) || 0) +
    (parseFloat(voucherForm.misc_fee) || 0);

  // Load Invoices
  useEffect(() => {
    loadInvoicesData();
  }, [selectedStatus]);

  const loadInvoicesData = async () => {
    setLoading(true);
    const data = await fetchInvoices(selectedStatus);
    setInvoices(data || mockInvoices);
    setLoading(false);
  };

  // Filtered List
  const filteredInvoices = invoices.filter((inv) => {
    const bld = inv.building || inv.residents?.building || 'Block A';
    const unit = inv.unitNumber || inv.residents?.unit_number || '';
    const name = inv.residentName || inv.residents?.name || '';
    const st = (inv.status || '').toLowerCase();

    const matchesBuilding = selectedBuilding === 'All' || bld === selectedBuilding;
    
    let matchesStatus = true;
    if (selectedStatus === 'Unpaid') {
      matchesStatus = st === 'unpaid';
    } else if (selectedStatus === 'Overdue') {
      matchesStatus = st === 'overdue';
    } else if (selectedStatus === 'Paid') {
      matchesStatus = st === 'paid' || st === 'verified';
    } else if (selectedStatus === 'Verified') {
      matchesStatus = st === 'verified';
    }

    const q = searchQuery.toLowerCase();
    const matchesSearch =
      `${bld} ${unit}`.toLowerCase().includes(q) ||
      name.toLowerCase().includes(q) ||
      (inv.id || '').toLowerCase().includes(q);

    return matchesBuilding && matchesStatus && matchesSearch;
  });

  // Calculate Metrics
  const totalCollected = invoices
    .filter((i) => i.status === 'paid' || i.status === 'verified')
    .reduce((acc, curr) => acc + (curr.totalAmount || curr.total_amount || curr.societyMaintenanceFee || curr.society_maintenance_fee || 0), 0);

  const totalOverdue = invoices
    .filter((i) => i.status === 'overdue')
    .reduce((acc, curr) => acc + (curr.totalAmount || curr.total_amount || curr.societyMaintenanceFee || curr.society_maintenance_fee || 0), 0);

  const pendingReceiptsCount = invoices.filter(
    (i) => (i.receiptImageUrl || i.receipt_image_url) && i.status !== 'verified' && i.status !== 'paid'
  ).length;

  const paidCount = invoices.filter((i) => i.status === 'paid' || i.status === 'verified').length;
  const collectionRate = invoices.length > 0 ? Math.round((paidCount / invoices.length) * 100) : 0;

  // Handle Generate Submit (Single Society Voucher issued to all units)
  const handleGenerateSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      guard_fee: parseFloat(voucherForm.guard_fee) || 0,
      sweeper_fee: parseFloat(voucherForm.sweeper_fee) || 0,
      water_fee: parseFloat(voucherForm.water_fee) || 0,
      generator_fee: parseFloat(voucherForm.generator_fee) || 0,
      misc_fee: parseFloat(voucherForm.misc_fee) || 0,
      society_maintenance_fee: totalMaintenanceFee,
      due_date: voucherForm.due_date,
      account_shown: voucherForm.account_shown,
    };

    await generateCycleInvoicesApi(payload);
    alert(`Monthly cycle vouchers issued successfully (Rs. ${totalMaintenanceFee.toLocaleString()} / unit) for all community units!`);
    setShowGenerateModal(false);
    loadInvoicesData();
  };

  // Handle Mark as Paid (Cash / Direct Transfer collected at society office)
  const handleMarkPaid = async (invId) => {
    setPayingInvoiceId(invId);
    try {
      await payInvoiceApi(invId);
      setInvoices((prev) =>
        prev.map((i) => (i.id === invId ? { ...i, status: 'paid' } : i))
      );
    } catch (err) {
      console.error('Error marking invoice paid:', err);
    } finally {
      setPayingInvoiceId(null);
    }
  };

  // Handle Verify Receipt Submit
  const handleVerifySubmit = async (invId) => {
    setInvoices((prev) =>
      prev.map((i) => (i.id === invId ? { ...i, status: 'verified' } : i))
    );
    setShowReceiptModal(false);
    await verifyInvoiceReceiptApi(invId);
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy tracking-tight">Finance & Maintenance Vouchers</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Single standard monthly voucher for all units, itemized maintenance services, and bank receipt verification.
          </p>
        </div>

        <button
          onClick={() => setShowGenerateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm rounded-lg shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Issue Monthly Cycle Voucher</span>
        </button>
      </div>

      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="metric-card border-l-4 border-l-emerald-500">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Collection</span>
          <div className="mt-2 text-2xl font-bold text-navy">Rs. {totalCollected.toLocaleString()}</div>
          <p className="text-xs text-emerald-600 font-semibold mt-1">Direct Society Bank Account</p>
        </div>

        <div className="metric-card border-l-4 border-l-red-500">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Overdue Dues</span>
          <div className="mt-2 text-2xl font-bold text-navy">Rs. {totalOverdue.toLocaleString()}</div>
          <p className="text-xs text-red-600 font-semibold mt-1">Automated WhatsApp notices</p>
        </div>

        <div className="metric-card border-l-4 border-l-amber-500">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending Verification</span>
          <div className="mt-2 text-2xl font-bold text-navy">{pendingReceiptsCount} Receipts</div>
          <p className="text-xs text-amber-600 font-semibold mt-1">WhatsApp Receipt Photos Sent</p>
        </div>

        <div className="metric-card border-l-4 border-l-navy">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Collection Rate</span>
          <div className="mt-2 text-2xl font-bold text-navy">{collectionRate}%</div>
          <p className="text-xs text-slate-500 mt-1">{paidCount} of {invoices.length} units settled</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-1 overflow-x-auto">
          {['All', 'Unpaid', 'Overdue', 'Paid', 'Verified'].map((st) => (
            <button
              key={st}
              onClick={() => setSelectedStatus(st)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                selectedStatus === st
                  ? 'bg-navy text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="text-xs font-bold text-slate-400 uppercase">Building:</span>
            <select
              value={selectedBuilding}
              onChange={(e) => setSelectedBuilding(e.target.value)}
              className="bg-white border border-slate-200 text-xs font-semibold text-slate-800 rounded px-2 py-1 focus:outline-none"
            >
              {mockBuildings.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 w-52 shadow-sm">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search resident, unit..."
              className="bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none w-full"
            />
          </div>
        </div>
      </div>

      {/* Cumulative Invoices Table */}
      <div className="bg-white rounded-lg border border-surface-border shadow-sm overflow-hidden">
        <div className="p-4 border-b border-surface-border bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-brand-600" />
            <h2 className="font-bold text-navy text-sm">Resident Maintenance Vouchers ({filteredInvoices.length})</h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">Standard Society Voucher</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-600 uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Resident & Unit</th>
                <th className="px-4 py-3">Monthly Maintenance Due</th>
                <th className="px-4 py-3">Due Date</th>
                <th className="px-4 py-3">Society Account</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    No vouchers found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const bld = inv.building || inv.residents?.building || 'Block A';
                  const unit = inv.unitNumber || inv.residents?.unit_number || '101';
                  const name = inv.residentName || inv.residents?.name || 'Resident';
                  const total = inv.totalAmount || inv.total_amount || inv.societyMaintenanceFee || inv.society_maintenance_fee || 0;
                  const dueDate = inv.dueDate || inv.due_date || 'N/A';
                  const account = inv.accountShown || inv.account_shown || 'Meezan Bank - Society Account';
                  const receiptUrl = inv.receiptImageUrl || inv.receipt_image_url;
                  const isSettled = inv.status === 'verified' || inv.status === 'paid';

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-bold text-navy">{name}</p>
                        <p className="text-[10px] text-slate-500 font-mono">{bld} - Unit {unit}</p>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-navy text-sm">
                        Rs. {total.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{dueDate}</td>
                      <td className="px-4 py-3 text-slate-500 text-[11px] truncate max-w-xs" title={account}>
                        {account}
                      </td>
                      <td className="px-4 py-3">
                        {inv.status === 'verified' ? (
                          <span className="status-pill status-pill-paid flex items-center gap-1 w-fit">
                            <CheckCircle2 className="w-3 h-3" /> VERIFIED
                          </span>
                        ) : inv.status === 'paid' ? (
                          <span className="status-pill status-pill-paid flex items-center gap-1 w-fit">
                            <Check className="w-3 h-3" /> PAID
                          </span>
                        ) : inv.status === 'overdue' ? (
                          <span className="status-pill status-pill-overdue">OVERDUE</span>
                        ) : (
                          <span className="status-pill status-pill-unpaid">UNPAID</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Receipt Preview */}
                          {receiptUrl && (
                            <button
                              onClick={() => { setSelectedInvoice(inv); setShowReceiptModal(true); }}
                              className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded border border-blue-200 transition-colors flex items-center gap-1 font-semibold"
                              title="View Payment Receipt Screenshot"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Receipt</span>
                            </button>
                          )}

                          {/* Action Button */}
                          {!isSettled ? (
                            <button
                              onClick={() => handleMarkPaid(inv.id)}
                              disabled={payingInvoiceId === inv.id}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold rounded border border-emerald-200 flex items-center gap-1 transition-colors disabled:opacity-50"
                              title="Mark voucher paid for cash/bank collection"
                            >
                              <Check className="w-3 h-3" />
                              <span>{payingInvoiceId === inv.id ? 'Marking...' : 'Mark Paid'}</span>
                            </button>
                          ) : (
                            <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Settled
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SINGLE SOCIETY VOUCHER CONFIGURATION & ISSUE MODAL */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden my-auto">
            {/* Fixed Header */}
            <div className="p-4 sm:p-5 bg-navy text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-base flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-brand-400" /> Issue Monthly Cycle Voucher
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Single standardized voucher applied uniformly to all society units.
                </p>
              </div>
              <button 
                type="button"
                onClick={() => setShowGenerateModal(false)} 
                className="text-slate-400 hover:text-white p-1 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form with Scrollable Body and Fixed Footer */}
            <form onSubmit={handleGenerateSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-4 sm:p-5 space-y-4 text-xs overflow-y-auto flex-1">
                <div className="text-slate-600 font-medium">
                  Set itemized breakdown for society maintenance services:
                </div>

                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      🛡️ Security & Guard Fee (Rs.)
                    </label>
                    <input
                      type="number"
                      required
                      value={voucherForm.guard_fee}
                      onChange={(e) => setVoucherForm({ ...voucherForm, guard_fee: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded font-mono bg-white text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      🧹 Sweeper & Sanitation (Rs.)
                    </label>
                    <input
                      type="number"
                      required
                      value={voucherForm.sweeper_fee}
                      onChange={(e) => setVoucherForm({ ...voucherForm, sweeper_fee: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded font-mono bg-white text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      🚰 Water Supply & Tankers (Rs.)
                    </label>
                    <input
                      type="number"
                      required
                      value={voucherForm.water_fee}
                      onChange={(e) => setVoucherForm({ ...voucherForm, water_fee: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded font-mono bg-white text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      ⚡ Generator & Backup (Rs.)
                    </label>
                    <input
                      type="number"
                      required
                      value={voucherForm.generator_fee}
                      onChange={(e) => setVoucherForm({ ...voucherForm, generator_fee: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded font-mono bg-white text-slate-800"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">
                      🔧 Misc & Common Maintenance (Rs.)
                    </label>
                    <input
                      type="number"
                      required
                      value={voucherForm.misc_fee}
                      onChange={(e) => setVoucherForm({ ...voucherForm, misc_fee: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded font-mono bg-white text-slate-800"
                    />
                  </div>
                </div>

                {/* Total Calculated Monthly Due */}
                <div className="p-3.5 bg-brand-50 border border-brand-200 rounded-lg flex items-center justify-between">
                  <div>
                    <p className="font-bold text-navy text-sm">Total Maintenance Due per Unit</p>
                    <p className="text-[11px] text-slate-600">Auto-sum of all society services</p>
                  </div>
                  <span className="text-xl font-bold text-brand-600 font-mono">
                    Rs. {totalMaintenanceFee.toLocaleString()}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Payment Due Date</label>
                    <input
                      type="date"
                      required
                      value={voucherForm.due_date}
                      onChange={(e) => setVoucherForm({ ...voucherForm, due_date: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded font-mono bg-white text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Society Bank Account / Payment Instructions
                    </label>
                    <input
                      type="text"
                      required
                      value={voucherForm.account_shown}
                      onChange={(e) => setVoucherForm({ ...voucherForm, account_shown: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded bg-white text-slate-800"
                    />
                  </div>
                </div>
              </div>

              {/* Fixed Footer with Visible Action Buttons */}
              <div className="p-4 border-t border-slate-200 bg-slate-50/80 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowGenerateModal(false)}
                  className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-medium rounded-lg transition-colors text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-lg shadow flex items-center gap-1.5 transition-colors text-xs"
                >
                  <Receipt className="w-4 h-4" />
                  <span>Issue Voucher to All Units</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: RECEIPT PREVIEW & VERIFICATION */}
      {showReceiptModal && selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden my-auto">
            <div className="p-4 sm:p-5 bg-navy text-white flex items-center justify-between shrink-0">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Eye className="w-5 h-5 text-brand-400" /> Payment Receipt Verification
              </h3>
              <button 
                type="button"
                onClick={() => setShowReceiptModal(false)} 
                className="text-slate-400 hover:text-white p-1 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4 text-xs overflow-y-auto flex-1">
              <div className="space-y-1">
                <p className="font-bold text-navy text-sm">
                  {selectedInvoice.residentName || selectedInvoice.residents?.name} (Unit {selectedInvoice.unitNumber || selectedInvoice.residents?.unit_number})
                </p>
                <p className="text-slate-500">
                  Amount Due: <strong className="text-navy font-mono">Rs. {(selectedInvoice.totalAmount || selectedInvoice.total_amount || selectedInvoice.societyMaintenanceFee || selectedInvoice.society_maintenance_fee || 0).toLocaleString()}</strong>
                </p>
              </div>

              {/* Receipt Image Preview */}
              <div className="border border-slate-200 rounded-lg overflow-hidden max-h-64 bg-slate-100 flex items-center justify-center">
                <img
                  src={selectedInvoice.receiptImageUrl || selectedInvoice.receipt_image_url}
                  alt="Payment Receipt"
                  className="object-contain max-h-64 w-full"
                />
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] space-y-1">
                <p className="font-bold text-slate-700">Society Account Shown on Bill:</p>
                <p className="font-mono text-slate-600">{selectedInvoice.accountShown || selectedInvoice.account_shown}</p>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50/80 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowReceiptModal(false)}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-medium rounded-lg transition-colors text-xs"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => handleVerifySubmit(selectedInvoice.id)}
                className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-lg shadow flex items-center gap-1.5 transition-colors text-xs"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Verify Payment</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
