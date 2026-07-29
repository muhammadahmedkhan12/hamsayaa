import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Eye,
  Edit3,
  Building,
  DollarSign,
  FileText,
  X,
  ExternalLink,
  ShieldCheck,
  Ban
} from 'lucide-react';
import { mockInvoices, mockBuildings } from '../services/mockData';
import { fetchInvoices, generateCycleInvoicesApi, editInvoiceApi, verifyInvoiceReceiptApi } from '../services/api';

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedBuilding, setSelectedBuilding] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Modals
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  // Form States
  const [generateForm, setGenerateForm] = useState({
    society_maintenance_fee: 5000,
    hamsayaa_saas_fee: 150,
    utility_charges: 1200,
    due_date: '2026-08-15',
    account_shown: 'Meezan Bank - A/C 01020304050607 - Lakeview Maint Account',
  });

  const [editForm, setEditForm] = useState({
    society_maintenance_fee: 5000,
    hamsayaa_saas_fee: 150,
    utility_charges: 0,
    due_date: '',
    account_shown: '',
  });

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

    const matchesBuilding = selectedBuilding === 'All' || bld === selectedBuilding;
    const matchesStatus = selectedStatus === 'All' || inv.status === selectedStatus.toLowerCase();
    const q = searchQuery.toLowerCase();
    const matchesSearch = `${bld} ${unit}`.toLowerCase().includes(q) || name.toLowerCase().includes(q) || inv.id.toLowerCase().includes(q);

    return matchesBuilding && matchesStatus && matchesSearch;
  });

  // Calculate Metrics
  const totalOverdue = invoices.filter(i => i.status === 'overdue').reduce((acc, curr) => acc + (curr.totalAmount || curr.total_amount || 0), 0);
  const pendingReceiptsCount = invoices.filter(i => i.receiptImageUrl || i.receipt_image_url).length;

  // Handle Edit Click
  const handleOpenEdit = (inv) => {
    setSelectedInvoice(inv);
    setEditForm({
      society_maintenance_fee: inv.societyMaintenanceFee || inv.society_maintenance_fee || 5000,
      hamsayaa_saas_fee: inv.hamsayaaSaasFee || inv.hamsayaa_saas_fee || 150,
      utility_charges: inv.utilityCharges || inv.utility_charges || 0,
      due_date: inv.dueDate || inv.due_date || '2026-08-15',
      account_shown: inv.accountShown || inv.account_shown || 'Meezan Bank - A/C 01020304050607 - Lakeview Maint Account',
    });
    setShowEditModal(true);
  };

  // Handle Edit Submit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    const newMaint = parseFloat(editForm.society_maintenance_fee) || 0;
    const newSaas = parseFloat(editForm.hamsayaa_saas_fee) || 0;
    const newUtil = parseFloat(editForm.utility_charges) || 0;
    const newTotal = newMaint + newSaas + newUtil;

    setInvoices((prev) =>
      prev.map((i) =>
        i.id === selectedInvoice.id
          ? {
              ...i,
              societyMaintenanceFee: newMaint,
              society_maintenance_fee: newMaint,
              hamsayaaSaasFee: newSaas,
              hamsayaa_saas_fee: newSaas,
              utilityCharges: newUtil,
              utility_charges: newUtil,
              totalAmount: newTotal,
              total_amount: newTotal,
              dueDate: editForm.due_date,
              due_date: editForm.due_date,
              accountShown: editForm.account_shown,
              account_shown: editForm.account_shown,
            }
          : i
      )
    );

    setShowEditModal(false);
    await editInvoiceApi(selectedInvoice.id, {
      society_maintenance_fee: newMaint,
      hamsayaa_saas_fee: newSaas,
      utility_charges: newUtil,
      due_date: editForm.due_date,
      account_shown: editForm.account_shown,
    });
  };

  // Handle Generate Submit
  const handleGenerateSubmit = async (e) => {
    e.preventDefault();
    await generateCycleInvoicesApi(generateForm);
    alert('Monthly cycle invoices generated successfully for all units!');
    setShowGenerateModal(false);
    loadInvoicesData();
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
          <h1 className="text-2xl font-bold text-navy tracking-tight">Dues & Cumulative Invoices</h1>
          <p className="text-sm text-slate-500 mt-0.5">Itemized resident bills, editable line items (maintenance, Hamsayaa SaaS fee, utilities), and bank receipt verification.</p>
        </div>

        <button
          onClick={() => setShowGenerateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-brand-50 text-brand-500 border border-brand-500 font-semibold text-sm rounded-lg shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Generate Cycle Invoices</span>
        </button>
      </div>

      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="metric-card border-l-4 border-l-brand-500">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Collection</span>
          <div className="mt-2 text-2xl font-bold text-navy">Rs. 385,000</div>
          <p className="text-xs text-brand-600 font-semibold mt-1">Direct Society Bank Account</p>
        </div>

        <div className="metric-card border-l-4 border-l-red-500">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Overdue Dues</span>
          <div className="mt-2 text-2xl font-bold text-navy">Rs. {totalOverdue.toLocaleString()}</div>
          <p className="text-xs text-red-600 font-semibold mt-1">Manual Block control enabled</p>
        </div>

        <div className="metric-card border-l-4 border-l-amber-500">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending Verification</span>
          <div className="mt-2 text-2xl font-bold text-navy">{pendingReceiptsCount} Receipts</div>
          <p className="text-xs text-amber-600 font-semibold mt-1">WhatsApp Receipt Photos Sent</p>
        </div>

        <div className="metric-card border-l-4 border-l-navy">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Default SaaS Fee</span>
          <div className="mt-2 text-2xl font-bold text-navy">Rs. 150 / Unit</div>
          <p className="text-xs text-slate-400 mt-1">Itemized on Resident Invoice</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-1 overflow-x-auto">
          {['All', 'Unpaid', 'Overdue', 'Verified'].map((st) => (
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
            <h2 className="font-bold text-navy text-sm">Resident Cumulative Invoices ({filteredInvoices.length})</h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">Editable Line Items Enabled</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-600 uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Resident & Unit</th>
                <th className="px-4 py-3">Maintenance Fee</th>
                <th className="px-4 py-3">Hamsayaa SaaS Fee</th>
                <th className="px-4 py-3">Utility Charges</th>
                <th className="px-4 py-3">Total Cumulative Amount</th>
                <th className="px-4 py-3">Due Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.map((inv) => {
                const bld = inv.building || inv.residents?.building || 'Block A';
                const unit = inv.unitNumber || inv.residents?.unit_number || '101';
                const name = inv.residentName || inv.residents?.name || 'Resident';
                const maint = inv.societyMaintenanceFee || inv.society_maintenance_fee || 0;
                const saas = inv.hamsayaaSaasFee || inv.hamsayaa_saas_fee || 0;
                const util = inv.utilityCharges || inv.utility_charges || 0;
                const total = inv.totalAmount || inv.total_amount || (maint + saas + util);
                const dueDate = inv.dueDate || inv.due_date || '';
                const receiptUrl = inv.receiptImageUrl || inv.receipt_image_url;

                return (
                  <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-bold text-navy">{name}</p>
                      <p className="text-[10px] text-slate-500 font-mono">{bld} - Unit {unit}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700">Rs. {maint.toLocaleString()}</td>
                    <td className="px-4 py-3 font-mono text-slate-700">Rs. {saas.toLocaleString()}</td>
                    <td className="px-4 py-3 font-mono text-slate-700">Rs. {util.toLocaleString()}</td>
                    <td className="px-4 py-3 font-mono font-bold text-navy text-sm">Rs. {total.toLocaleString()}</td>
                    <td className="px-4 py-3 text-slate-600">{dueDate}</td>
                    <td className="px-4 py-3">
                      {inv.status === 'verified' ? (
                        <span className="status-pill status-pill-paid flex items-center gap-1 w-fit">
                          <CheckCircle2 className="w-3 h-3" /> VERIFIED
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
                            className="p-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded border border-blue-200 transition-colors"
                            title="View Payment Receipt Screenshot"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Edit Line Items */}
                        <button
                          onClick={() => handleOpenEdit(inv)}
                          className="px-2.5 py-1 bg-slate-100 text-navy hover:bg-slate-200 font-bold rounded border border-slate-300 flex items-center gap-1 transition-colors"
                          title="Edit Invoice Line Items (Maintenance, SaaS Fee, Utilities)"
                        >
                          <Edit3 className="w-3 h-3" /> Edit Bill
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: GENERATE CYCLE INVOICES */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="p-5 bg-navy text-white flex items-center justify-between">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Receipt className="w-5 h-5 text-brand-400" /> Generate Monthly Cycle Invoices
              </h3>
              <button onClick={() => setShowGenerateModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGenerateSubmit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Society Maintenance Fee (Rs.)</label>
                <input
                  type="number"
                  required
                  value={generateForm.society_maintenance_fee}
                  onChange={(e) => setGenerateForm({ ...generateForm, society_maintenance_fee: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg font-mono bg-white text-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Hamsayaa SaaS Fee (Rs.)</label>
                <input
                  type="number"
                  required
                  value={generateForm.hamsayaa_saas_fee}
                  onChange={(e) => setGenerateForm({ ...generateForm, hamsayaa_saas_fee: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg font-mono bg-white text-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Default Utility Charges (Rs.)</label>
                <input
                  type="number"
                  value={generateForm.utility_charges}
                  onChange={(e) => setGenerateForm({ ...generateForm, utility_charges: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg font-mono bg-white text-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Due Date</label>
                <input
                  type="date"
                  required
                  value={generateForm.due_date}
                  onChange={(e) => setGenerateForm({ ...generateForm, due_date: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg font-mono bg-white text-slate-800"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowGenerateModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-lg shadow"
                >
                  Generate All Invoices
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT INVOICE LINE ITEMS (PRD SECTION 3.1 & 3.2 REQUIREMENT) */}
      {showEditModal && selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="p-5 bg-navy text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-brand-400" /> Edit Resident Bill
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Unit {selectedInvoice.unitNumber || selectedInvoice.residents?.unit_number} — {selectedInvoice.residentName || selectedInvoice.residents?.name}
                </p>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Society Maintenance Fee (Rs.)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editForm.society_maintenance_fee}
                    onChange={(e) => setEditForm({ ...editForm, society_maintenance_fee: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono bg-white text-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Hamsayaa SaaS Fee (Rs.)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editForm.hamsayaa_saas_fee}
                    onChange={(e) => setEditForm({ ...editForm, hamsayaa_saas_fee: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono bg-white text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Utility Charges (Rs.)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.utility_charges}
                    onChange={(e) => setEditForm({ ...editForm, utility_charges: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono bg-white text-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    required
                    value={editForm.due_date}
                    onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono bg-white text-slate-800"
                  />
                </div>
              </div>

              {/* Calculated Total Display */}
              <div className="p-3 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-between">
                <span className="font-bold text-slate-700">Updated Total Amount:</span>
                <span className="text-base font-bold text-navy font-mono">
                  Rs. {(
                    (parseFloat(editForm.society_maintenance_fee) || 0) +
                    (parseFloat(editForm.hamsayaa_saas_fee) || 0) +
                    (parseFloat(editForm.utility_charges) || 0)
                  ).toLocaleString()}
                </span>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-lg shadow"
                >
                  Save Invoice Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: RECEIPT PREVIEW & VERIFICATION */}
      {showReceiptModal && selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="p-5 bg-navy text-white flex items-center justify-between">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Eye className="w-5 h-5 text-brand-400" /> Payment Receipt Verification
              </h3>
              <button onClick={() => setShowReceiptModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="space-y-1">
                <p className="font-bold text-navy text-sm">
                  {selectedInvoice.residentName || selectedInvoice.residents?.name} (Unit {selectedInvoice.unitNumber || selectedInvoice.residents?.unit_number})
                </p>
                <p className="text-slate-500">Amount Due: <strong className="text-navy font-mono">Rs. {(selectedInvoice.totalAmount || selectedInvoice.total_amount).toLocaleString()}</strong></p>
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

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowReceiptModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => handleVerifySubmit(selectedInvoice.id)}
                  className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-lg shadow flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Verify Payment</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
