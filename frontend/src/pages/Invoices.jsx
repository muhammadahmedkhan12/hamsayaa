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
  Wrench,
  Send,
  Sliders,
  Settings,
  Edit3,
  RotateCw,
  UserCheck,
  Calendar,
  CreditCard,
  RefreshCw
} from 'lucide-react';
import { mockInvoices, mockBuildings } from '../services/mockData';
import {
  fetchInvoices,
  generateCycleInvoicesApi,
  verifyInvoiceReceiptApi,
  payInvoiceApi,
  retryFailedVouchersApi,
  resendSingleVoucherApi
} from '../services/api';

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedBuilding, setSelectedBuilding] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Modals
  const [showEditVoucherModal, setShowEditVoucherModal] = useState(false);
  const [showSendConfirmModal, setShowSendConfirmModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showMarkPaidModal, setShowMarkPaidModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoiceToPay, setInvoiceToPay] = useState(null);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);
  const [isSendingVouchers, setIsSendingVouchers] = useState(false);
  const [isRetryingFailed, setIsRetryingFailed] = useState(false);
  const [resendingId, setResendingId] = useState(null);
  const [sendWhatsAppToggle, setSendWhatsAppToggle] = useState(true);
  const [bannerNotice, setBannerNotice] = useState(null);

  // Payment collection accountability form
  const [collectorName, setCollectorName] = useState(() => {
    return localStorage.getItem('hamsayaa_collector_name') || 'Building Admin';
  });
  const [paymentMethod, setPaymentMethod] = useState('Cash');

  // Society Standard Voucher Template State (persisted locally)
  const [voucherForm, setVoucherForm] = useState(() => {
    try {
      const saved = localStorage.getItem('hamsayaa_voucher_template');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      guard_fee: 2500,
      sweeper_fee: 1000,
      water_fee: 1500,
      generator_fee: 1000,
      misc_fee: 500,
      due_date: '2026-09-15',
      account_shown: 'Meezan Bank - A/C 01020304050607 - Lakeview Maint Account',
    };
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

  // Failed Vouchers Count
  const failedVouchersCount = invoices.filter(
    (i) => i.whatsapp_delivery?.status === 'failed'
  ).length;

  // Handle Save Voucher Template (Only updates settings, does NOT send)
  const handleSaveTemplate = (e) => {
    e.preventDefault();
    try {
      localStorage.setItem('hamsayaa_voucher_template', JSON.stringify(voucherForm));
    } catch (err) {}
    setShowEditVoucherModal(false);
    setBannerNotice({
      type: 'success',
      message: `Voucher template updated: Total Rs. ${totalMaintenanceFee.toLocaleString()} / unit. Click 'Send Vouchers' whenever you're ready to dispatch.`,
    });
    setTimeout(() => setBannerNotice(null), 6000);
  };

  // Handle Send Vouchers (Updates portal records AND dispatches WhatsApp messages)
  const handleSendVouchers = async () => {
    setIsSendingVouchers(true);
    const payload = {
      guard_fee: parseFloat(voucherForm.guard_fee) || 0,
      sweeper_fee: parseFloat(voucherForm.sweeper_fee) || 0,
      water_fee: parseFloat(voucherForm.water_fee) || 0,
      generator_fee: parseFloat(voucherForm.generator_fee) || 0,
      misc_fee: parseFloat(voucherForm.misc_fee) || 0,
      society_maintenance_fee: totalMaintenanceFee,
      due_date: voucherForm.due_date,
      account_shown: voucherForm.account_shown,
      send_whatsapp: sendWhatsAppToggle,
    };

    try {
      const res = await generateCycleInvoicesApi(payload);
      setShowSendConfirmModal(false);
      
      const sent = res.whatsapp_sent_count ?? 0;
      const already = res.whatsapp_already_delivered_count ?? 0;
      const failed = res.whatsapp_failed_count ?? 0;

      setBannerNotice({
        type: failed > 0 ? 'warning' : 'success',
        message: `Vouchers processed! Sent: ${sent} newly delivered, ${already} previously received (skipped), ${failed} failed.`,
      });
      setTimeout(() => setBannerNotice(null), 8000);
      await loadInvoicesData();
    } catch (err) {
      console.error('Error sending vouchers:', err);
      setBannerNotice({
        type: 'error',
        message: 'Failed to issue vouchers. Please check server connection.',
      });
    } finally {
      setIsSendingVouchers(false);
    }
  };

  // Handle Dedicated "Retry Failed" Broadcast
  const handleRetryFailed = async () => {
    setIsRetryingFailed(true);
    try {
      const res = await retryFailedVouchersApi({
        ...voucherForm,
        society_maintenance_fee: totalMaintenanceFee,
      });
      setBannerNotice({
        type: res.still_failed_count > 0 ? 'warning' : 'success',
        message: `Retry completed: ${res.retried_count || 0} successfully delivered, ${res.still_failed_count || 0} still failed.`,
      });
      setTimeout(() => setBannerNotice(null), 7000);
      await loadInvoicesData();
    } catch (err) {
      console.error('Error retrying failed vouchers:', err);
    } finally {
      setIsRetryingFailed(false);
    }
  };

  // Handle Resend Single Voucher
  const handleResendSingle = async (invId) => {
    setResendingId(invId);
    try {
      const res = await resendSingleVoucherApi(invId);
      if (res.status === 'success') {
        setInvoices((prev) =>
          prev.map((i) =>
            i.id === invId
              ? { ...i, whatsapp_delivery: { status: 'delivered' } }
              : i
          )
        );
        setBannerNotice({
          type: 'success',
          message: res.message || 'Voucher resent successfully!',
        });
      } else {
        setBannerNotice({
          type: 'error',
          message: res.message || 'Delivery failed. Check resident number or Meta window.',
        });
      }
      setTimeout(() => setBannerNotice(null), 5000);
    } catch (err) {
      console.error('Error resending single voucher:', err);
    } finally {
      setResendingId(null);
    }
  };

  // Open the "Mark Paid" Modal with collector details
  const handleOpenMarkPaidModal = (inv) => {
    setInvoiceToPay(inv);
    setShowMarkPaidModal(true);
  };

  // Submit Payment Collection Record
  const handleConfirmPayment = async (e) => {
    e.preventDefault();
    if (!invoiceToPay) return;

    setIsMarkingPaid(true);
    const nowIso = new Date().toISOString();
    const finalCollector = collectorName.trim() || 'Building Admin';

    try {
      // Remember collector name for subsequent receipts
      try {
        localStorage.setItem('hamsayaa_collector_name', finalCollector);
      } catch (e) {}

      await payInvoiceApi(invoiceToPay.id, {
        collected_by: finalCollector,
        payment_method: paymentMethod,
      });

      setInvoices((prev) =>
        prev.map((i) =>
          i.id === invoiceToPay.id
            ? {
                ...i,
                status: 'paid',
                verified_by: finalCollector,
                verified_at: nowIso,
              }
            : i
        )
      );

      setShowMarkPaidModal(false);
      setBannerNotice({
        type: 'success',
        message: `Payment recorded for ${invoiceToPay.residentName || invoiceToPay.residents?.name} (Rs. ${(invoiceToPay.totalAmount || invoiceToPay.total_amount).toLocaleString()}) collected by ${finalCollector}.`,
      });
      setTimeout(() => setBannerNotice(null), 6000);
    } catch (err) {
      console.error('Error marking invoice paid:', err);
    } finally {
      setIsMarkingPaid(false);
    }
  };

  // Handle Verify Receipt Submit (from resident WhatsApp screenshot)
  const handleVerifySubmit = async (invId) => {
    const finalCollector = collectorName.trim() || 'Building Admin';
    const nowIso = new Date().toISOString();

    setInvoices((prev) =>
      prev.map((i) =>
        i.id === invId
          ? { ...i, status: 'verified', verified_by: finalCollector, verified_at: nowIso }
          : i
      )
    );
    setShowReceiptModal(false);
    await verifyInvoiceReceiptApi(invId);
  };

  // Skeleton shimmer block (matching Dashboard tab)
  const Skeleton = ({ className = '' }) => (
    <div className={`animate-pulse bg-slate-200 rounded ${className}`} />
  );

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-navy tracking-tight">Finance & Maintenance Vouchers</h1>
            <p className="text-sm text-slate-500 mt-0.5">Loading live data from database...</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 text-slate-400 font-medium text-xs rounded-lg shadow-xs">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-brand-600" />
            <span>Syncing...</span>
          </div>
        </div>

        {/* Skeleton Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="metric-card border-l-4 border-l-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-8 w-8 rounded-lg" />
              </div>
              <Skeleton className="h-8 w-24 mt-2" />
              <Skeleton className="h-3 w-32 mt-1" />
            </div>
          ))}
        </div>

        {/* Skeleton Filter Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-2">
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-7 w-16 rounded-lg" />
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-7 w-28 rounded" />
            <Skeleton className="h-7 w-52 rounded-lg" />
          </div>
        </div>

        {/* Skeleton Table Container */}
        <div className="bg-white rounded-lg border border-surface-border shadow-sm overflow-hidden">
          <div className="p-4 border-b border-surface-border bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded-full" />
              <Skeleton className="h-4 w-52" />
            </div>
            <Skeleton className="h-3 w-40" />
          </div>
          <div className="divide-y divide-slate-100">
            {[1, 2, 3, 4, 5, 6].map((j) => (
              <div key={j} className="p-4 flex items-center justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-5 w-28 rounded-full" />
                <Skeleton className="h-7 w-20 rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Banner Notice */}
      {bannerNotice && (
        <div
          className={`p-3.5 rounded-lg border text-xs font-semibold flex items-center justify-between shadow-xs ${
            bannerNotice.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : bannerNotice.type === 'warning'
              ? 'bg-amber-50 text-amber-800 border-amber-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {bannerNotice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : bannerNotice.type === 'warning' ? (
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{bannerNotice.message}</span>
          </div>
          <button
            onClick={() => setBannerNotice(null)}
            className="text-slate-400 hover:text-slate-700 ml-4"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* DEDICATED RETRY FAILED BAR (Appears ONLY if any units failed delivery) */}
      {failedVouchersCount > 0 && (
        <div className="p-3.5 rounded-lg border border-amber-300 bg-amber-50/90 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5 text-amber-950 font-medium">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>{failedVouchersCount} voucher{failedVouchersCount > 1 ? 's' : ''}</strong> failed to deliver via WhatsApp (e.g. resident outside 24-hr care window or phone issue).
            </span>
          </div>
          <button
            onClick={handleRetryFailed}
            disabled={isRetryingFailed}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded shadow-xs text-xs transition-colors shrink-0 disabled:opacity-50"
            title="Retry WhatsApp dispatch ONLY for the failed units"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isRetryingFailed ? 'animate-spin' : ''}`} />
            <span>{isRetryingFailed ? 'Retrying Failed...' : `Retry Failed (${failedVouchersCount})`}</span>
          </button>
        </div>
      )}

      {/* Header Bar with Distinct "Edit Voucher" & "Send Vouchers" Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy tracking-tight">Finance & Maintenance Vouchers</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Single standard voucher for all units: Rs. {totalMaintenanceFee.toLocaleString()} / unit (Due: {voucherForm.due_date}).
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Action 0: Refresh Button */}
          <button
            onClick={loadInvoicesData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-semibold text-xs rounded-lg shadow-2xs transition-colors disabled:opacity-50"
            title="Refresh invoices and delivery notices"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-brand-600' : 'text-slate-500'}`} />
            <span>Refresh</span>
          </button>

          {/* Action 1: Edit Voucher Form */}
          <button
            onClick={() => setShowEditVoucherModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-semibold text-xs rounded-lg shadow-2xs transition-colors"
            title="Configure monthly maintenance services and society bank account"
          >
            <Settings className="w-3.5 h-3.5 text-slate-500" />
            <span>Edit Voucher</span>
          </button>

          {/* Action 2: Send Vouchers (Updates portal & sends WhatsApp messages) */}
          <button
            onClick={() => setShowSendConfirmModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white font-semibold text-xs rounded-lg shadow-sm transition-colors"
            title="Issue monthly vouchers on the portal and broadcast WhatsApp bills to residents"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send Vouchers</span>
          </button>
        </div>
      </div>

      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="metric-card border-l-4 border-l-emerald-500">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Collection</span>
          {loading ? (
            <div className="mt-2 h-8 w-32 bg-slate-200 animate-pulse rounded"></div>
          ) : (
            <div className="mt-2 text-2xl font-bold text-navy">Rs. {totalCollected.toLocaleString()}</div>
          )}
          <p className="text-xs text-emerald-600 font-semibold mt-1">Direct Society Bank Account</p>
        </div>

        <div className="metric-card border-l-4 border-l-red-500">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Overdue Dues</span>
          {loading ? (
            <div className="mt-2 h-8 w-32 bg-slate-200 animate-pulse rounded"></div>
          ) : (
            <div className="mt-2 text-2xl font-bold text-navy">Rs. {totalOverdue.toLocaleString()}</div>
          )}
          <p className="text-xs text-red-600 font-semibold mt-1">Automated WhatsApp notices</p>
        </div>

        <div className="metric-card border-l-4 border-l-amber-500">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending Verification</span>
          {loading ? (
            <div className="mt-2 h-8 w-24 bg-slate-200 animate-pulse rounded"></div>
          ) : (
            <div className="mt-2 text-2xl font-bold text-navy">{pendingReceiptsCount} Receipts</div>
          )}
          <p className="text-xs text-amber-600 font-semibold mt-1">WhatsApp Receipt Photos Sent</p>
        </div>

        <div className="metric-card border-l-4 border-l-navy">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Collection Rate</span>
          {loading ? (
            <div className="mt-2 h-8 w-20 bg-slate-200 animate-pulse rounded"></div>
          ) : (
            <div className="mt-2 text-2xl font-bold text-navy">{collectionRate}%</div>
          )}
          <p className="text-xs text-slate-500 mt-1">
            {loading ? 'Calculating settlement rate...' : `${paidCount} of ${invoices.length} units settled`}
          </p>
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
            <h2 className="font-bold text-navy text-sm">
              Resident Maintenance Vouchers {loading ? '' : `(${filteredInvoices.length})`}
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">Full Collector & Timestamp Accountability</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-600 uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Resident & Unit</th>
                <th className="px-4 py-3">Monthly Due</th>
                <th className="px-4 py-3">Due Date</th>
                <th className="px-4 py-3">WhatsApp Notice</th>
                <th className="px-4 py-3">Payment Status & Audit</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2.5">
                      <RefreshCw className="w-5 h-5 text-brand-600 animate-spin" />
                      <span className="text-xs font-medium text-slate-600">Loading society maintenance vouchers...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
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
                  const receiptUrl = inv.receiptImageUrl || inv.receipt_image_url;
                  const isSettled = inv.status === 'verified' || inv.status === 'paid';
                  const delivery = inv.whatsapp_delivery || { status: 'pending' };
                  const collector = inv.verified_by || inv.verifiedBy;
                  const collectionTime = inv.verified_at || inv.verifiedAt;

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
                      
                      {/* WhatsApp Delivery Status Column */}
                      <td className="px-4 py-3">
                        {delivery.status === 'delivered' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Delivered
                          </span>
                        ) : delivery.status === 'failed' ? (
                          <div className="flex items-center gap-1.5">
                            <span
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200 cursor-help"
                              title={delivery.error || 'WhatsApp delivery failed (Outside 24h window or phone issue)'}
                            >
                              <AlertTriangle className="w-3 h-3 text-red-600" /> Failed
                            </span>
                            <button
                              onClick={() => handleResendSingle(inv.id)}
                              disabled={resendingId === inv.id}
                              className="p-1 text-slate-500 hover:text-brand-600 hover:bg-slate-100 rounded transition-colors disabled:opacity-50"
                              title="Resend WhatsApp voucher to this unit"
                            >
                              <RotateCw className={`w-3.5 h-3.5 ${resendingId === inv.id ? 'animate-spin text-brand-600' : ''}`} />
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px] font-medium">— Pending</span>
                        )}
                      </td>

                      {/* Payment Status with Collector & Timestamp Accountability */}
                      <td className="px-4 py-3">
                        {inv.status === 'verified' ? (
                          <div className="space-y-0.5">
                            <span className="status-pill status-pill-paid flex items-center gap-1 w-fit">
                              <CheckCircle2 className="w-3 h-3" /> VERIFIED
                            </span>
                            {collector && (
                              <p className="text-[10px] text-slate-600 flex items-center gap-1 pt-0.5">
                                <UserCheck className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>Collector: <strong className="text-slate-800">{collector}</strong></span>
                              </p>
                            )}
                            {collectionTime && (
                              <p className="text-[9px] text-slate-400 font-mono">
                                {formatTimestamp(collectionTime)}
                              </p>
                            )}
                          </div>
                        ) : inv.status === 'paid' ? (
                          <div className="space-y-0.5">
                            <span className="status-pill status-pill-paid flex items-center gap-1 w-fit">
                              <Check className="w-3 h-3" /> PAID
                            </span>
                            {collector && (
                              <p className="text-[10px] text-slate-600 flex items-center gap-1 pt-0.5">
                                <UserCheck className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>Collector: <strong className="text-slate-800">{collector}</strong></span>
                              </p>
                            )}
                            {collectionTime && (
                              <p className="text-[9px] text-slate-400 font-mono">
                                {formatTimestamp(collectionTime)}
                              </p>
                            )}
                          </div>
                        ) : inv.status === 'overdue' ? (
                          <span className="status-pill status-pill-overdue">OVERDUE</span>
                        ) : (
                          <span className="status-pill status-pill-unpaid">UNPAID</span>
                        )}
                      </td>

                      {/* Actions */}
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

                          {/* Mark Paid Action Button (Opens Collector modal) */}
                          {!isSettled ? (
                            <button
                              onClick={() => handleOpenMarkPaidModal(inv)}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold rounded border border-emerald-200 flex items-center gap-1 transition-colors"
                              title="Record payment collection with collector name & time"
                            >
                              <Check className="w-3 h-3" />
                              <span>Mark Paid</span>
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

      {/* MODAL: RECORD PAYMENT COLLECTION (Collector & Timestamp Accountability) */}
      {showMarkPaidModal && invoiceToPay && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden my-auto">
            {/* Header */}
            <div className="p-4 sm:p-5 bg-emerald-700 text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-base flex items-center gap-2">
                  <UserCheck className="w-5 h-5" /> Record Payment Collection
                </h3>
                <p className="text-xs text-emerald-100 mt-0.5">
                  Record who collected the cash/cheque and log the timestamp.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowMarkPaidModal(false)}
                className="text-white/80 hover:text-white p-1 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleConfirmPayment} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-5 space-y-4 text-xs overflow-y-auto flex-1">
                {/* Summary Card */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Resident:</span>
                    <span className="font-bold text-navy">
                      {invoiceToPay.residentName || invoiceToPay.residents?.name} (Unit {invoiceToPay.unitNumber || invoiceToPay.residents?.unit_number})
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                    <span className="text-slate-500 font-medium">Amount Due:</span>
                    <span className="text-base font-bold text-emerald-700 font-mono">
                      Rs. {(invoiceToPay.totalAmount || invoiceToPay.total_amount || invoiceToPay.societyMaintenanceFee || invoiceToPay.society_maintenance_fee || 0).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Input: Collector Name */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    👤 Payment Collected By (Staff / Admin Name)
                  </label>
                  <input
                    type="text"
                    required
                    value={collectorName}
                    onChange={(e) => setCollectorName(e.target.value)}
                    placeholder="e.g. Tariq (Treasurer), Building Manager, Reception"
                    className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    This name will be stamped permanently on the financial audit trail.
                  </p>
                </div>

                {/* Input: Payment Method */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    💳 Payment Method
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {['Cash (Office)', 'Bank / Raast', 'Cheque'].map((method) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setPaymentMethod(method)}
                        className={`py-2 px-2 text-center rounded-lg border text-xs font-semibold transition-colors ${
                          paymentMethod === method
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {method}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Timestamp Display */}
                <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-lg flex items-center justify-between text-[11px]">
                  <span className="text-emerald-800 font-medium flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-emerald-600" />
                    Collection Timestamp:
                  </span>
                  <span className="font-mono font-bold text-emerald-900">
                    {new Date().toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="p-4 border-t border-slate-200 bg-slate-50/80 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowMarkPaidModal(false)}
                  disabled={isMarkingPaid}
                  className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-medium rounded-lg transition-colors text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isMarkingPaid}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow flex items-center gap-1.5 transition-colors text-xs disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{isMarkingPaid ? 'Saving...' : 'Confirm Payment & Stamp Audit'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 1: EDIT VOUCHER TEMPLATE */}
      {showEditVoucherModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden my-auto">
            {/* Fixed Header */}
            <div className="p-4 sm:p-5 bg-navy text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-base flex items-center gap-2">
                  <Settings className="w-5 h-5 text-brand-400" /> Edit Monthly Voucher Template
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Configure the itemized maintenance fee breakdown and payment instructions.
                </p>
              </div>
              <button 
                type="button"
                onClick={() => setShowEditVoucherModal(false)} 
                className="text-slate-400 hover:text-white p-1 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form with Scrollable Body and Fixed Footer */}
            <form onSubmit={handleSaveTemplate} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-4 sm:p-5 space-y-4 text-xs overflow-y-auto flex-1">
                <div className="text-slate-600 font-medium">
                  Set the itemized breakdown for society maintenance services:
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

              {/* Fixed Footer */}
              <div className="p-4 border-t border-slate-200 bg-slate-50/80 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowEditVoucherModal(false)}
                  className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-medium rounded-lg transition-colors text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-navy hover:bg-navy/90 text-white font-semibold rounded-lg shadow flex items-center gap-1.5 transition-colors text-xs"
                >
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Save Voucher Settings</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: SEND VOUCHERS CONFIRMATION */}
      {showSendConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden my-auto">
            {/* Header */}
            <div className="p-4 sm:p-5 bg-brand-500 text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-base flex items-center gap-2">
                  <Send className="w-5 h-5" /> Send Monthly Vouchers
                </h3>
                <p className="text-xs text-brand-100 mt-0.5">
                  Update the portal and broadcast bills to all community units.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSendConfirmModal(false)}
                className="text-white/80 hover:text-white p-1 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Confirmation Details */}
            <div className="p-5 space-y-4 text-xs overflow-y-auto flex-1">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">Total Payable per Unit:</span>
                  <span className="text-base font-bold text-navy font-mono">
                    Rs. {totalMaintenanceFee.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[11px] text-slate-600">
                  <span>Payment Due Date:</span>
                  <span className="font-semibold text-slate-800">{voucherForm.due_date}</span>
                </div>
                <div className="flex justify-between items-start text-[11px] text-slate-600">
                  <span>Bank Account:</span>
                  <span className="font-mono text-slate-800 text-right max-w-[200px] truncate" title={voucherForm.account_shown}>
                    {voucherForm.account_shown}
                  </span>
                </div>
              </div>

              {/* Service Breakdown Summary */}
              <div className="text-slate-500 text-[11px] space-y-1">
                <span className="font-bold text-slate-700">Included Services Breakdown:</span>
                <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-600 bg-slate-100/70 p-2 rounded">
                  <span>🛡️ Guard: Rs. {voucherForm.guard_fee}</span>
                  <span>🧹 Sweeper: Rs. {voucherForm.sweeper_fee}</span>
                  <span>🚰 Water: Rs. {voucherForm.water_fee}</span>
                  <span>⚡ Generator: Rs. {voucherForm.generator_fee}</span>
                  <span className="col-span-2">🔧 Misc: Rs. {voucherForm.misc_fee}</span>
                </div>
              </div>

              {/* WhatsApp Broadcast Checkbox */}
              <label className="flex items-start gap-2.5 p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendWhatsAppToggle}
                  onChange={(e) => setSendWhatsAppToggle(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <div>
                  <p className="font-bold text-emerald-900 text-xs">
                    Broadcast WhatsApp bills to residents
                  </p>
                  <p className="text-[11px] text-emerald-700 mt-0.5">
                    Sends the itemized bill with bank details directly to each resident's WhatsApp number. Units that already received it will be safely skipped.
                  </p>
                </div>
              </label>
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-slate-200 bg-slate-50/80 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowSendConfirmModal(false)}
                disabled={isSendingVouchers}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-medium rounded-lg transition-colors text-xs disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendVouchers}
                disabled={isSendingVouchers}
                className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-lg shadow flex items-center gap-1.5 transition-colors text-xs disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>{isSendingVouchers ? 'Sending Vouchers...' : 'Confirm & Send Vouchers'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: RECEIPT PREVIEW & VERIFICATION */}
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
