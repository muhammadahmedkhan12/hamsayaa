import React, { useState, useEffect, useRef } from 'react';
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
  RefreshCw,
  Download,
  FileSpreadsheet,
  Printer,
  Filter,
  History
} from 'lucide-react';
import { mockInvoices, mockBuildings } from '../services/mockData';
import {
  fetchInvoices,
  generateCycleInvoicesApi,
  verifyInvoiceReceiptApi,
  payInvoiceApi,
  retryFailedVouchersApi,
  resendSingleVoucherApi,
  exportCollectionStatementApi,
  fetchResidentBillingHistory
} from '../services/api';

// Continuous circular loop marquee ("starts again where it finishes" conveyor belt)
function CircularMarqueeText({ text }) {
  const containerRef = useRef(null);
  const textRef = useRef(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [duration, setDuration] = useState(16);

  useEffect(() => {
    const calculateOverflow = () => {
      if (containerRef.current && textRef.current) {
        const textWidth = textRef.current.offsetWidth;
        const containerWidth = containerRef.current.clientWidth;
        if (textWidth > containerWidth) {
          setIsOverflowing(true);
          // Calm, steady reading pace (~20px/s)
          const scrollSpeed = 20;
          const calculatedDuration = Math.max(12, Math.round((textWidth + 28) / scrollSpeed));
          setDuration(calculatedDuration);
        } else {
          setIsOverflowing(false);
        }
      }
    };

    calculateOverflow();
    const timer = setTimeout(calculateOverflow, 250);
    window.addEventListener('resize', calculateOverflow);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', calculateOverflow);
    };
  }, [text]);

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden flex-1 min-w-0 relative ${isOverflowing ? 'mask-fade-loop group/ticker' : ''}`}
      title={text}
    >
      <div
        className={`inline-flex items-center whitespace-nowrap ${
          isOverflowing ? 'animate-circular-loop group-hover/ticker:[animation-play-state:paused]' : ''
        }`}
        style={isOverflowing ? { '--marquee-duration': `${duration}s` } : {}}
      >
        <span ref={textRef} className="inline-flex items-center select-none text-slate-500 font-normal">
          {text}
          {isOverflowing && (
            <span className="text-slate-300 mx-3 text-[7px] shrink-0">●</span>
          )}
        </span>
        {isOverflowing && (
          <span className="inline-flex items-center select-none text-slate-500 font-normal" aria-hidden="true">
            {text}
            <span className="text-slate-300 mx-3 text-[7px] shrink-0">●</span>
          </span>
        )}
      </div>
    </div>
  );
}

// Smooth easing count-up animation for metrics with refined, calmer pacing
function AnimatedNumber({ value, duration = 1800, prefix = '', suffix = '' }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTimestamp = null;
    const startValue = 0;
    const endValue = typeof value === 'number' ? value : parseFloat(value) || 0;

    if (endValue === 0) {
      setDisplayValue(0);
      return;
    }

    const animDuration = endValue <= 10 ? 900 : duration;

    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / animDuration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startValue + (endValue - startValue) * easeProgress);
      setDisplayValue(current);

      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };

    const animId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(animId);
  }, [value, duration]);

  return (
    <span>
      {prefix && <span className="text-sm font-semibold text-slate-400 mr-1 font-sans">{prefix}</span>}
      {displayValue.toLocaleString()}
      {suffix && <span className="text-xl font-bold ml-0.5">{suffix}</span>}
    </span>
  );
}

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
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportStatus, setExportStatus] = useState('All');
  const [exportBuilding, setExportBuilding] = useState('All');
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoiceToPay, setInvoiceToPay] = useState(null);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);
  const [isSendingVouchers, setIsSendingVouchers] = useState(false);
  const [isRetryingFailed, setIsRetryingFailed] = useState(false);
  const [resendingId, setResendingId] = useState(null);
  const [sendWhatsAppToggle, setSendWhatsAppToggle] = useState(true);
  const [bannerNotice, setBannerNotice] = useState(null);

  // Resident Payment History / Ledger Modal State
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedResidentForHistory, setSelectedResidentForHistory] = useState(null);
  const [residentHistoryData, setResidentHistoryData] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyFilter, setHistoryFilter] = useState('All'); // 'All' | 'Paid' | 'Unpaid' | 'Receipts'
  const [previewReceiptUrl, setPreviewReceiptUrl] = useState(null);

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
  }, []);

  const loadInvoicesData = async () => {
    setLoading(true);
    const data = await fetchInvoices();
    setInvoices(data || mockInvoices);
    setLoading(false);
  };

  // Helper: Total invoice amount including arrears
  const getInvoiceAmount = (curr) => {
    if (!curr) return 0;
    if (curr.total_payable !== undefined) return Number(curr.total_payable);
    if (curr.totalPayable !== undefined) return Number(curr.totalPayable);
    const base = Number(curr.totalAmount || curr.total_amount || curr.societyMaintenanceFee || curr.society_maintenance_fee || 0);
    const arr = Number(curr.arrears || 0);
    return base + arr;
  };

  // Helper: Dynamic check if invoice is overdue (status is overdue OR status is unpaid past due date)
  const isInvoiceOverdue = (curr) => {
    if (!curr) return false;
    const st = (curr.status || '').toLowerCase();
    if (st === 'overdue') return true;
    if (st === 'unpaid') {
      const d = curr.dueDate || curr.due_date;
      if (d && new Date(d) < new Date(new Date().setHours(0, 0, 0, 0))) {
        return true;
      }
    }
    return false;
  };

  // Group invoices by unique resident unit to eliminate duplicates and calculate aggregate arrears
  const residentRoster = React.useMemo(() => {
    const residentMap = new Map();

    invoices.forEach((inv) => {
      const resId =
        inv.resident_id ||
        inv.residentId ||
        inv.residents?.id ||
        `${inv.building || inv.residents?.building || 'Block A'}-${inv.unitNumber || inv.residents?.unit_number || '101'}`;

      if (!residentMap.has(resId)) {
        residentMap.set(resId, []);
      }
      residentMap.get(resId).push(inv);
    });

    const roster = [];

    residentMap.forEach((invList, resId) => {
      // Sort invoices by due_date descending (latest cycle first)
      const sorted = [...invList].sort((a, b) => {
        const dateA = new Date(a.dueDate || a.due_date || 0);
        const dateB = new Date(b.dueDate || b.due_date || 0);
        return dateB - dateA;
      });

      const latest = sorted[0] || {};
      const resProfile = latest.residents || {};
      const building = latest.building || resProfile.building || 'Block A';
      const unitNumber = latest.unitNumber || resProfile.unit_number || '101';
      const residentName = latest.residentName || resProfile.name || 'Resident';
      const phoneNumber = latest.phoneNumber || resProfile.phone_number || '';
      const actualResidentId = latest.resident_id || latest.residentId || resProfile.id || resId;

      // Base fee of latest cycle
      const latestBaseFee = Number(
        latest.societyMaintenanceFee ||
        latest.society_maintenance_fee ||
        latest.totalAmount ||
        latest.total_amount ||
        0
      );

      // Identify prior unsettled invoices
      const priorInvoices = sorted.slice(1);
      const priorUnsettled = priorInvoices.filter(
        (i) => i.status !== 'paid' && i.status !== 'verified'
      );

      const computedPriorArrears = priorUnsettled.reduce((acc, curr) => {
        return acc + Number(curr.societyMaintenanceFee || curr.society_maintenance_fee || curr.totalAmount || curr.total_amount || 0);
      }, 0);

      // Arrears: use recorded arrears on latest invoice, or computed prior arrears
      const arrears = Number(latest.arrears !== undefined && latest.arrears !== null ? latest.arrears : computedPriorArrears);

      // Latest cycle settlement
      const isLatestSettled = latest.status === 'paid' || latest.status === 'verified';

      // Total balance due
      const totalBalanceDue = isLatestSettled
        ? 0
        : (latest.total_payable !== undefined
            ? Number(latest.total_payable)
            : latest.totalPayable !== undefined
            ? Number(latest.totalPayable)
            : latestBaseFee + arrears);

      // Determine overall status
      const hasPendingReceipt = sorted.some(
        (i) => (i.receiptImageUrl || i.receipt_image_url) && i.status !== 'verified' && i.status !== 'paid'
      );

      const isLatestOverdue = isInvoiceOverdue(latest);
      const hasArrears = arrears > 0;

      let effectiveStatus = 'unpaid';
      if (totalBalanceDue === 0) {
        effectiveStatus = latest.status === 'verified' ? 'verified' : 'paid';
      } else if (hasPendingReceipt) {
        effectiveStatus = 'pending_verification';
      } else if (isLatestOverdue || hasArrears) {
        effectiveStatus = 'overdue';
      } else {
        effectiveStatus = 'unpaid';
      }

      // Find pending receipt invoice if any
      const pendingInvoice = sorted.find(
        (i) => (i.receiptImageUrl || i.receipt_image_url) && i.status !== 'verified' && i.status !== 'paid'
      ) || latest;

      roster.push({
        id: actualResidentId,
        residentId: actualResidentId,
        residentName,
        building,
        unitNumber,
        phoneNumber,
        latestInvoice: latest,
        invoices: sorted,
        latestBaseFee,
        arrears,
        totalBalanceDue,
        effectiveStatus,
        isOverdue: effectiveStatus === 'overdue',
        isSettled: totalBalanceDue === 0,
        hasPendingReceipt,
        pendingInvoice,
        delivery: latest.whatsapp_delivery || { status: 'pending' },
        collector: latest.verified_by || latest.verifiedBy || latest.payment_audit?.collector,
        collectionTime: latest.verified_at || latest.verifiedAt || latest.payment_audit?.collected_at,
        dueDate: latest.dueDate || latest.due_date || 'N/A'
      });
    });

    return roster;
  }, [invoices]);

  // Filtered Resident Roster
  const filteredResidentRoster = residentRoster.filter((r) => {
    const matchesBuilding = selectedBuilding === 'All' || r.building === selectedBuilding;

    let matchesStatus = true;
    if (selectedStatus === 'Unpaid') {
      matchesStatus = r.effectiveStatus === 'unpaid';
    } else if (selectedStatus === 'Overdue') {
      matchesStatus = r.effectiveStatus === 'overdue';
    } else if (selectedStatus === 'Paid') {
      matchesStatus = r.effectiveStatus === 'paid' || r.effectiveStatus === 'verified';
    } else if (selectedStatus === 'Verified') {
      matchesStatus = r.effectiveStatus === 'verified';
    }

    const q = searchQuery.toLowerCase();
    const matchesSearch =
      `${r.building} ${r.unitNumber}`.toLowerCase().includes(q) ||
      r.residentName.toLowerCase().includes(q) ||
      r.phoneNumber.toLowerCase().includes(q) ||
      (r.latestInvoice?.id || '').toLowerCase().includes(q);

    return matchesBuilding && matchesStatus && matchesSearch;
  });

  // Legacy filtered invoices for export modal
  const filteredInvoices = invoices.filter((inv) => {
    const bld = inv.building || inv.residents?.building || 'Block A';
    const unit = inv.unitNumber || inv.residents?.unit_number || '';
    const name = inv.residentName || inv.residents?.name || '';
    const st = (inv.status || '').toLowerCase();
    const isOverdue = isInvoiceOverdue(inv);

    const matchesBuilding = selectedBuilding === 'All' || bld === selectedBuilding;

    let matchesStatus = true;
    if (selectedStatus === 'Unpaid') {
      matchesStatus = st === 'unpaid' && !isOverdue;
    } else if (selectedStatus === 'Overdue') {
      matchesStatus = isOverdue;
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

  // Available buildings derived dynamically with fallback to mockBuildings
  const dynamicBuildings = [
    'All',
    ...Array.from(
      new Set(
        residentRoster
          .map((r) => r.building)
          .filter(Boolean)
      )
    ).sort(),
  ];
  const availableBuildings = dynamicBuildings.length > 1 ? dynamicBuildings : mockBuildings;

  // Invoices filtered for the Export Modal scope
  const exportInvoices = invoices.filter((inv) => {
    const bld = inv.building || inv.residents?.building || 'Block A';
    const st = (inv.status || '').toLowerCase();
    const isOverdue = isInvoiceOverdue(inv);
    const matchesBuilding = exportBuilding === 'All' || bld === exportBuilding;
    let matchesStatus = true;
    if (exportStatus === 'Paid') {
      matchesStatus = st === 'paid' || st === 'verified';
    } else if (exportStatus === 'Unpaid') {
      matchesStatus = st === 'unpaid' || isOverdue;
    }
    return matchesBuilding && matchesStatus;
  });

  const exportTotalBilled = exportInvoices.reduce(
    (acc, curr) => acc + getInvoiceAmount(curr),
    0
  );
  const exportTotalCollected = exportInvoices
    .filter((i) => i.status === 'paid' || i.status === 'verified')
    .reduce(
      (acc, curr) => acc + getInvoiceAmount(curr),
      0
    );
  const exportTotalOutstanding = exportTotalBilled - exportTotalCollected;
  const exportRate =
    exportTotalBilled > 0
      ? ((exportTotalCollected / exportTotalBilled) * 100).toFixed(1)
      : '0.0';

  // Calculate Metrics from resident roster and raw invoices
  const totalCollected = invoices
    .filter((i) => i.status === 'paid' || i.status === 'verified')
    .reduce((acc, curr) => acc + getInvoiceAmount(curr), 0);

  const totalOverdue = residentRoster
    .filter((r) => r.isOverdue)
    .reduce((acc, r) => acc + r.totalBalanceDue, 0);

  const pendingReceiptsCount = residentRoster.filter((r) => r.hasPendingReceipt).length;

  const paidUnitsCount = residentRoster.filter((r) => r.isSettled).length;
  const collectionRate =
    residentRoster.length > 0 ? Math.round((paidUnitsCount / residentRoster.length) * 100) : 0;

  // Failed Vouchers Count on latest cycle
  const failedVouchersCount = residentRoster.filter(
    (r) => r.delivery?.status === 'failed'
  ).length;

  // Fetch Resident History from backend with fallback
  const loadResidentHistory = async (residentId) => {
    if (!residentId) return;
    setHistoryLoading(true);
    try {
      const res = await fetchResidentBillingHistory(residentId);
      if (res && res.status === 'success' && res.history) {
        setResidentHistoryData(res);
      } else {
        buildFallbackHistory(residentId);
      }
    } catch (err) {
      console.warn('Error fetching resident history:', err);
      buildFallbackHistory(residentId);
    } finally {
      setHistoryLoading(false);
    }
  };

  const buildFallbackHistory = (residentId) => {
    const residentItem = residentRoster.find((r) => r.residentId === residentId || r.id === residentId);
    const invList = residentItem?.invoices || invoices.filter((i) => (i.resident_id || i.residentId || i.residents?.id) === residentId);

    const sorted = [...invList].sort((a, b) => {
      const dateA = new Date(a.dueDate || a.due_date || 0);
      const dateB = new Date(b.dueDate || b.due_date || 0);
      return dateB - dateA;
    });

    const history = sorted.map((inv) => {
      const st = (inv.status || 'unpaid').toLowerCase();
      const baseFee = Number(
        inv.societyMaintenanceFee ||
        inv.society_maintenance_fee ||
        inv.totalAmount ||
        inv.total_amount ||
        0
      );
      const arr = Number(inv.arrears || 0);
      const audit = inv.payment_audit || {};
      const isOverdue = isInvoiceOverdue(inv);

      return {
        id: inv.id,
        due_date: inv.dueDate || inv.due_date,
        society_maintenance_fee: baseFee,
        arrears: arr,
        total_payable: inv.total_payable !== undefined ? Number(inv.total_payable) : (baseFee + arr),
        status: isOverdue ? 'overdue' : st,
        receipt_image_url: inv.receiptImageUrl || inv.receipt_image_url,
        payment_method: audit.method || (st === 'verified' ? 'WhatsApp Slip' : st === 'paid' ? 'Cash' : 'Unpaid'),
        collector: audit.collector || inv.verified_by || inv.verifiedBy,
        collected_at: audit.collected_at || inv.verified_at || inv.verifiedAt,
        reference_number: audit.reference_number || audit.txid || '',
        account_shown: inv.accountShown || inv.account_shown,
        whatsapp_delivery: inv.whatsapp_delivery || { status: 'pending' },
        payment_audit: audit
      };
    });

    const totalBilled = history.reduce((sum, h) => sum + h.society_maintenance_fee, 0);
    const totalPaid = history
      .filter((h) => h.status === 'paid' || h.status === 'verified')
      .reduce((sum, h) => sum + h.society_maintenance_fee, 0);
    const balanceDue = totalBilled - totalPaid;

    const resObj = sorted[0]?.residents || sorted[0] || {};

    setResidentHistoryData({
      resident: {
        id: residentId,
        name: resObj.name || resObj.residentName || residentItem?.residentName || 'Resident',
        building: resObj.building || residentItem?.building || 'Block A',
        unit_number: resObj.unit_number || resObj.unitNumber || residentItem?.unitNumber || '101',
        phone_number: resObj.phone_number || resObj.phoneNumber || residentItem?.phoneNumber || '',
      },
      summary: {
        total_billed: totalBilled,
        total_paid: totalPaid,
        balance_due: balanceDue > 0 ? balanceDue : 0,
        total_cycles: history.length,
        paid_cycles: history.filter((h) => h.status === 'paid' || h.status === 'verified').length,
        overdue_cycles: history.filter((h) => h.status === 'overdue').length,
        unpaid_cycles: history.filter((h) => h.status === 'unpaid').length,
      },
      history,
    });
  };

  const handleOpenHistoryModal = (residentItem) => {
    setSelectedResidentForHistory(residentItem);
    setShowHistoryModal(true);
    setHistoryFilter('All');
    loadResidentHistory(residentItem.residentId || residentItem.id);
  };

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

  // Open Mark Paid Modal for a specific history cycle
  const handleOpenMarkPaidForHistory = (historyItem) => {
    const matchingInv = invoices.find((i) => i.id === historyItem.id) || {
      id: historyItem.id,
      residentId: selectedResidentForHistory?.residentId || selectedResidentForHistory?.id,
      residentName: selectedResidentForHistory?.residentName,
      building: selectedResidentForHistory?.building,
      unitNumber: selectedResidentForHistory?.unitNumber,
      totalAmount: historyItem.total_payable || historyItem.society_maintenance_fee,
      total_amount: historyItem.total_payable || historyItem.society_maintenance_fee,
      status: historyItem.status,
      residents: {
        id: selectedResidentForHistory?.residentId || selectedResidentForHistory?.id,
        name: selectedResidentForHistory?.residentName,
        building: selectedResidentForHistory?.building,
        unit_number: selectedResidentForHistory?.unitNumber,
        phone_number: selectedResidentForHistory?.phoneNumber,
      }
    };
    handleOpenMarkPaidModal(matchingInv);
  };

  // Open Receipt Review Modal for a specific history cycle
  const handleOpenReceiptForHistory = (historyItem) => {
    const matchingInv = invoices.find((i) => i.id === historyItem.id) || {
      id: historyItem.id,
      residentId: selectedResidentForHistory?.residentId || selectedResidentForHistory?.id,
      residentName: selectedResidentForHistory?.residentName,
      building: selectedResidentForHistory?.building,
      unitNumber: selectedResidentForHistory?.unitNumber,
      receiptImageUrl: historyItem.receipt_image_url,
      receipt_image_url: historyItem.receipt_image_url,
      totalAmount: historyItem.total_payable || historyItem.society_maintenance_fee,
      total_amount: historyItem.total_payable || historyItem.society_maintenance_fee,
      accountShown: historyItem.account_shown || voucherForm.account_shown,
      account_shown: historyItem.account_shown || voucherForm.account_shown,
      payment_audit: historyItem.payment_audit || {},
      residents: {
        id: selectedResidentForHistory?.residentId || selectedResidentForHistory?.id,
        name: selectedResidentForHistory?.residentName,
        building: selectedResidentForHistory?.building,
        unit_number: selectedResidentForHistory?.unitNumber,
        phone_number: selectedResidentForHistory?.phoneNumber,
      }
    };
    setSelectedInvoice(matchingInv);
    setShowReceiptModal(true);
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
        message: `Payment recorded for ${invoiceToPay.residentName || invoiceToPay.residents?.name || 'Resident'} (Rs. ${(invoiceToPay.totalAmount || invoiceToPay.total_amount || invoiceToPay.society_maintenance_fee || invoiceToPay.societyMaintenanceFee || 0).toLocaleString()}) collected by ${finalCollector}.`,
      });
      setTimeout(() => setBannerNotice(null), 6000);
      if (selectedResidentForHistory) {
        loadResidentHistory(selectedResidentForHistory.residentId || selectedResidentForHistory.id);
      }
      loadInvoicesData();
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
    if (selectedResidentForHistory) {
      loadResidentHistory(selectedResidentForHistory.residentId || selectedResidentForHistory.id);
    }
    loadInvoicesData();
  };

  // Format Date Helper
  const formatTimestamp = (ts) => {
    if (!ts) return null;
    try {
      return new Date(ts).toLocaleString('en-PK', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch (e) {
      return ts;
    }
  };

  // Action: Download CSV Statement
  const handleDownloadCsv = async () => {
    setIsExportingCsv(true);
    try {
      // First attempt download from backend streaming export endpoint
      const blob = await exportCollectionStatementApi({
        status: exportStatus,
        building: exportBuilding,
        format: 'csv'
      });

      let finalBlob = blob;

      // Resilient client-side fallback if backend unreachable
      if (!finalBlob) {
        const rows = [
          ['================================================================================'],
          ['HAMSAYAA - OFFICIAL SOCIETY MAINTENANCE COLLECTION STATEMENT'],
          ['================================================================================'],
          ['Society Name:', 'Lakeview Apartments'],
          ['Generated At:', new Date().toLocaleString('en-PK')],
          ['Scope - Status:', exportStatus],
          ['Scope - Building:', exportBuilding],
          [],
          ['--- FINANCIAL SUMMARY ---'],
          ['Total Units Assessed:', exportInvoices.length],
          ['Total Billed (PKR):', exportTotalBilled.toLocaleString()],
          ['Total Realized Collections (PKR):', exportTotalCollected.toLocaleString()],
          ['Outstanding Balance (PKR):', exportTotalOutstanding.toLocaleString()],
          ['Collection Efficiency Rate:', `${exportRate}%`],
          [],
          ['--- ITEMIZED COLLECTION ROSTER ---'],
          [
            'Invoice ID',
            'Building / Block',
            'Unit Number',
            'Resident Name',
            'Phone Number',
            'Status',
            'Total Billed (PKR)',
            'Amount Paid (PKR)',
            'Outstanding Balance (PKR)',
            'Due Date',
            'Payment Method',
            'Collected / Verified By',
            'Verification Timestamp',
            'TxID / Bank Ref'
          ]
        ];

        exportInvoices.forEach((inv) => {
          const res = inv.residents || {};
          const bld = inv.building || res.building || '';
          const unit = inv.unitNumber || res.unit_number || '';
          const name = inv.residentName || res.name || 'Resident';
          const phone = res.phone_number || '';
          const st = (inv.status || 'unpaid').toLowerCase();
          const isPaid = st === 'paid' || st === 'verified';
          const total = Number(
            inv.totalAmount ||
              inv.total_amount ||
              inv.societyMaintenanceFee ||
              inv.society_maintenance_fee ||
              0
          );
          const paid = isPaid ? total : 0;
          const balance = isPaid ? 0 : total;
          const audit = inv.payment_audit || {};

          rows.push([
            inv.id || '',
            bld,
            unit,
            name,
            phone,
            st.toUpperCase(),
            total.toFixed(2),
            paid.toFixed(2),
            balance.toFixed(2),
            inv.dueDate || inv.due_date || '',
            audit.method || (st === 'verified' ? 'Bank Slip' : st === 'paid' ? 'Cash' : '—'),
            inv.verified_by || audit.collector || '—',
            inv.verified_at || audit.collected_at || '—',
            audit.reference_number || ''
          ]);
        });

        rows.push([]);
        rows.push([
          'TOTALS',
          '',
          '',
          `${exportInvoices.length} Units`,
          '',
          '',
          exportTotalBilled.toFixed(2),
          exportTotalCollected.toFixed(2),
          exportTotalOutstanding.toFixed(2),
          '',
          '',
          '',
          '',
          ''
        ]);

        const csvContent = rows
          .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
          .join('\r\n');

        finalBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      }

      const url = URL.createObjectURL(finalBlob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `Hamsayaa_Collection_Statement_${new Date().toISOString().slice(0, 10)}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setBannerNotice({
        type: 'success',
        message: 'Collection statement spreadsheet (CSV) downloaded successfully!'
      });
      setTimeout(() => setBannerNotice(null), 5000);
      setShowExportModal(false);
    } catch (err) {
      console.error('Failed to export CSV statement:', err);
      setBannerNotice({
        type: 'error',
        message: 'Failed to generate collection spreadsheet. Please try again.'
      });
      setTimeout(() => setBannerNotice(null), 5000);
    } finally {
      setIsExportingCsv(false);
    }
  };

  // Action: Print / Save as PDF Statement
  const handlePrintPdfStatement = () => {
    try {
      const societyTitle = 'Lakeview Apartments';
      const printDate = new Date().toLocaleString('en-PK', {
        dateStyle: 'full',
        timeStyle: 'short'
      });
      const dueDate = voucherForm.due_date || 'N/A';

      const tableRowsHtml = exportInvoices
        .map((inv, idx) => {
          const res = inv.residents || {};
          const bld = inv.building || res.building || 'Block A';
          const unit = inv.unitNumber || res.unit_number || '';
          const name = inv.residentName || res.name || 'Resident';
          const phone = res.phone_number || '—';
          const st = (inv.status || 'unpaid').toLowerCase();
          const isPaid = st === 'paid' || st === 'verified';
          const total = Number(
            inv.total_payable !== undefined
              ? inv.total_payable
              : inv.totalPayable !== undefined
              ? inv.totalPayable
              : (Number(inv.totalAmount || inv.total_amount || inv.societyMaintenanceFee || inv.society_maintenance_fee || 0) + Number(inv.arrears || 0))
          );
          const paid = isPaid ? total : 0;
          const balance = isPaid ? 0 : total;
          const audit = inv.payment_audit || {};
          const method =
            audit.method || (st === 'verified' ? 'Bank Slip' : st === 'paid' ? 'Cash' : '—');
          const collector = inv.verified_by || audit.collector || '—';
          const verifiedAt =
            inv.verified_at || audit.collected_at
              ? formatTimestamp(inv.verified_at || audit.collected_at)
              : '—';

          const dueDate = inv.dueDate || inv.due_date;
          const isOverdue = !isPaid && (st === 'overdue' || (dueDate && new Date(dueDate) < new Date(new Date().setHours(0, 0, 0, 0))));

          const statusBadge = isPaid
            ? `<span style="background-color: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; padding: 3px 8px; border-radius: 9999px; font-weight: 700; font-size: 10px; display: inline-block;">PAID</span>`
            : isOverdue
            ? `<span style="background-color: #fef2f2; color: #991b1b; border: 1px solid #fecaca; padding: 3px 8px; border-radius: 9999px; font-weight: 700; font-size: 10px; display: inline-block;">OVERDUE</span>`
            : `<span style="background-color: #fffbeb; color: #92400e; border: 1px solid #fde68a; padding: 3px 8px; border-radius: 9999px; font-weight: 700; font-size: 10px; display: inline-block;">UNPAID</span>`;

          return `
            <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
              <td style="padding: 8px 10px; font-weight: 600; color: #64748b; font-family: monospace;">#${idx + 1}</td>
              <td style="padding: 8px 10px;">
                <strong style="color: #0f172a; font-size: 12px;">${name}</strong><br/>
                <span style="color: #475569; font-size: 10px; font-family: monospace;">${bld} - Unit ${unit}</span>
              </td>
              <td style="padding: 8px 10px; font-family: monospace; color: #475569;">${phone}</td>
              <td style="padding: 8px 10px; text-align: center;">${statusBadge}</td>
              <td style="padding: 8px 10px; text-align: right; font-weight: 700; font-family: monospace; color: #0f172a;">Rs. ${total.toLocaleString()}</td>
              <td style="padding: 8px 10px; text-align: right; font-weight: 700; font-family: monospace; color: #059669;">Rs. ${paid.toLocaleString()}</td>
              <td style="padding: 8px 10px; text-align: right; font-weight: 700; font-family: monospace; color: ${balance > 0 ? '#b91c1c' : '#64748b'};">Rs. ${balance.toLocaleString()}</td>
              <td style="padding: 8px 10px; color: #334155; font-size: 10px;">${method}</td>
              <td style="padding: 8px 10px; color: #334155; font-size: 10px;">
                <strong>${collector}</strong><br/>
                <span style="color: #64748b; font-size: 9px;">${verifiedAt}</span>
              </td>
            </tr>
          `;
        })
        .join('');

      const printWindow = window.open('', '_blank', 'width=1100,height=800');
      if (!printWindow) {
        alert('Please allow popups for this site to view the printable Statement of Collection.');
        return;
      }

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8"/>
          <title>Statement of Collection - ${societyTitle}</title>
          <style>
            @media print {
              @page { size: A4 landscape; margin: 12mm; }
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .no-print { display: none !important; }
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              color: #1e293b;
              margin: 0;
              padding: 24px;
              background-color: #fff;
              line-height: 1.4;
            }
            .header-bar {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              border-bottom: 2px solid #00569e;
              padding-bottom: 16px;
              margin-bottom: 18px;
            }
            .brand-title {
              font-size: 22px;
              font-weight: 800;
              color: #00569e;
              letter-spacing: -0.02em;
              margin: 0;
            }
            .statement-title {
              font-size: 14px;
              font-weight: 700;
              color: #0f172a;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              margin-top: 4px;
            }
            .meta-text {
              font-size: 11px;
              color: #64748b;
              margin-top: 2px;
            }
            .kpi-container {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 12px;
              margin-bottom: 20px;
            }
            .kpi-card {
              border: 1px solid #e2e8f0;
              background-color: #f8fafc;
              border-radius: 8px;
              padding: 12px 14px;
            }
            .kpi-label {
              font-size: 10px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              color: #64748b;
            }
            .kpi-val {
              font-size: 18px;
              font-weight: 800;
              color: #0f172a;
              margin-top: 4px;
              font-family: monospace;
            }
            .breakdown-box {
              background-color: #f1f5f9;
              border: 1px solid #cbd5e1;
              border-radius: 6px;
              padding: 10px 14px;
              margin-bottom: 18px;
              font-size: 11px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              flex-wrap: wrap;
              gap: 8px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            th {
              background-color: #f1f5f9;
              color: #475569;
              font-size: 10px;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              font-weight: 700;
              padding: 10px;
              border-bottom: 2px solid #cbd5e1;
            }
            .totals-row td {
              padding: 10px;
              background-color: #f8fafc;
              border-top: 2px solid #0f172a;
              font-weight: 800;
              font-size: 12px;
            }
            .signatures-block {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 20px;
              margin-top: 36px;
              padding-top: 20px;
            }
            .sig-line {
              border-top: 1px solid #94a3b8;
              padding-top: 8px;
              text-align: center;
              font-size: 11px;
              color: #475569;
            }
            .print-btn-bar {
              position: fixed;
              top: 16px;
              right: 16px;
              background: white;
              border: 1px solid #cbd5e1;
              box-shadow: 0 4px 12px rgba(0,0,0,0.15);
              padding: 8px 14px;
              border-radius: 8px;
              display: flex;
              gap: 8px;
              z-index: 1000;
            }
            .action-btn {
              background-color: #00569e;
              color: white;
              border: none;
              padding: 6px 14px;
              border-radius: 6px;
              font-size: 12px;
              font-weight: 600;
              cursor: pointer;
            }
            .action-btn:hover { background-color: #00437a; }
            .cancel-btn {
              background-color: #f1f5f9;
              color: #475569;
              border: 1px solid #cbd5e1;
              padding: 6px 12px;
              border-radius: 6px;
              font-size: 12px;
              cursor: pointer;
            }
          </style>
        </head>
        <body>
          <div class="print-btn-bar no-print">
            <button class="action-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
            <button class="cancel-btn" onclick="window.close()">Close</button>
          </div>

          <div class="header-bar">
            <div>
              <h1 class="brand-title">${societyTitle}</h1>
              <div class="statement-title">Society Maintenance Statement of Collection</div>
              <div class="meta-text">Official Property Ledger & Financial Audit Record</div>
            </div>
            <div style="text-align: right;">
              <div style="font-weight: 700; color: #0f172a; font-size: 12px;">Billing Cycle: Due ${dueDate}</div>
              <div class="meta-text">Generated: ${printDate}</div>
              <div class="meta-text">Scope: ${exportStatus} Dues | ${exportBuilding === 'All' ? 'All Blocks' : exportBuilding}</div>
            </div>
          </div>

          <div class="kpi-container">
            <div class="kpi-card">
              <div class="kpi-label">Assessed Units</div>
              <div class="kpi-val">${exportInvoices.length} Units</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Total Assessed / Billed</div>
              <div class="kpi-val" style="color: #00569e;">Rs. ${exportTotalBilled.toLocaleString()}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Realized Collections</div>
              <div class="kpi-val" style="color: #059669;">Rs. ${exportTotalCollected.toLocaleString()}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Outstanding Balance</div>
              <div class="kpi-val" style="color: ${exportTotalOutstanding > 0 ? '#b91c1c' : '#059669'};">Rs. ${exportTotalOutstanding.toLocaleString()}</div>
              <div style="font-size: 10px; color: #64748b; margin-top: 2px;">Realization Rate: <strong>${exportRate}%</strong></div>
            </div>
          </div>

          <div class="breakdown-box">
            <div><strong>Approved Monthly Tariff:</strong> Rs. ${totalMaintenanceFee.toLocaleString()} per unit (Guard: Rs. ${voucherForm.guard_fee}, Sweeper: Rs. ${voucherForm.sweeper_fee}, Water: Rs. ${voucherForm.water_fee}, Generator: Rs. ${voucherForm.generator_fee}, Misc: Rs. ${voucherForm.misc_fee})</div>
            <div><strong>Deposit Account:</strong> <span style="font-family: monospace;">${voucherForm.account_shown}</span></div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="text-align: left; width: 40px;">#</th>
                <th style="text-align: left;">Resident & Apartment</th>
                <th style="text-align: left;">WhatsApp Phone</th>
                <th style="text-align: center;">Status</th>
                <th style="text-align: right;">Billed Due</th>
                <th style="text-align: right;">Paid Amount</th>
                <th style="text-align: right;">Balance</th>
                <th style="text-align: left;">Method</th>
                <th style="text-align: left;">Verification / Audit</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
            <tfoot>
              <tr class="totals-row">
                <td colspan="4" style="text-align: right; text-transform: uppercase;">Total Collections Summary:</td>
                <td style="text-align: right; font-family: monospace; color: #00569e;">Rs. ${exportTotalBilled.toLocaleString()}</td>
                <td style="text-align: right; font-family: monospace; color: #059669;">Rs. ${exportTotalCollected.toLocaleString()}</td>
                <td style="text-align: right; font-family: monospace; color: ${exportTotalOutstanding > 0 ? '#b91c1c' : '#059669'};">Rs. ${exportTotalOutstanding.toLocaleString()}</td>
                <td colspan="2" style="font-size: 10px; color: #64748b;">Collection Efficiency: ${exportRate}%</td>
              </tr>
            </tfoot>
          </table>

          <div class="signatures-block">
            <div class="sig-line">
              <strong>Prepared By:</strong><br/>
              Building Management Office
            </div>
            <div class="sig-line">
              <strong>Verified & Reconciled By:</strong><br/>
              Society Treasurer / Finance In-Charge
            </div>
            <div class="sig-line">
              <strong>Approved By:</strong><br/>
              President / Management Committee
            </div>
          </div>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 400);
            };
          </script>
        </body>
        </html>
      `;

      printWindow.document.open();
      printWindow.document.write(htmlContent);
      printWindow.document.close();

      setBannerNotice({
        type: 'success',
        message: 'Print preview loaded! You can print or select "Save as PDF" to download an official PDF copy.'
      });
      setTimeout(() => setBannerNotice(null), 6000);
      setShowExportModal(false);
    } catch (err) {
      console.error('Error generating printable PDF statement:', err);
    }
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
            <div key={i} className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-4 rounded" />
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

        <div className="flex items-center gap-2">
          {/* Action 0: Refresh Button */}
          <button
            onClick={loadInvoicesData}
            disabled={loading}
            className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-medium text-xs rounded-lg shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
            title="Refresh invoices and delivery notices"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-brand-600' : 'text-slate-500'}`} />
            <span>Refresh</span>
          </button>

          {/* Action 1: Export Report */}
          <button
            onClick={() => setShowExportModal(true)}
            className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-medium text-xs rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
            title="Export Collection Statement (Excel / CSV & Printable PDF)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export Report</span>
          </button>

          {/* Action 2: Edit Voucher Form */}
          <button
            onClick={() => setShowEditVoucherModal(true)}
            className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-medium text-xs rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
            title="Configure monthly maintenance services and society bank account"
          >
            <Settings className="w-3.5 h-3.5 text-slate-500" />
            <span>Edit Voucher</span>
          </button>

          {/* Action 2: Send Vouchers (Updates portal & sends WhatsApp messages) */}
          <button
            onClick={() => setShowSendConfirmModal(true)}
            className="px-3.5 py-2 bg-brand-500 hover:bg-brand-600 text-white font-semibold text-xs rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
            title="Issue monthly vouchers on the portal and broadcast WhatsApp bills to residents"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send Vouchers</span>
          </button>
        </div>
      </div>

      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Total Collection */}
        <div
          onClick={() => setSelectedStatus('Paid')}
          className="relative overflow-hidden bg-gradient-to-b from-white to-slate-50/50 p-5 rounded-xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)] hover:border-slate-300 hover:-translate-y-0.5 transition-transform transition-shadow duration-200 group flex flex-col justify-between cursor-pointer"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-brand-500/5 rounded-full blur-xl pointer-events-none -mr-4 -mt-4" />

          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600 tracking-wide group-hover:text-navy transition-colors">
                Total Collection
              </span>
              <div className="w-8 h-8 rounded-lg bg-brand-500/10 border border-brand-500/20 text-brand-600 flex items-center justify-center group-hover:scale-105 transition-transform shadow-2xs">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-3 flex items-baseline">
              <span className="text-3xl font-bold text-navy tracking-tight">
                <AnimatedNumber value={totalCollected} prefix="Rs. " />
              </span>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 mt-4 font-normal flex items-center justify-between border-t border-slate-100 pt-3 gap-2">
            <div className="flex items-center gap-1.5 flex-1 min-w-0" title="Direct society maintenance account · Automated WhatsApp vouchers">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <CircularMarqueeText text="Direct society maintenance account · Automated WhatsApp vouchers" />
            </div>
            <span className="text-brand-600 font-semibold group-hover:translate-x-0.5 transition-transform shrink-0">
              Filter paid →
            </span>
          </div>
        </div>

        {/* Card 2: Overdue Dues */}
        <div
          onClick={() => setSelectedStatus('Overdue')}
          className="relative overflow-hidden bg-gradient-to-b from-white to-slate-50/50 p-5 rounded-xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)] hover:border-slate-300 hover:-translate-y-0.5 transition-transform transition-shadow duration-200 group flex flex-col justify-between cursor-pointer"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-brand-500/5 rounded-full blur-xl pointer-events-none -mr-4 -mt-4" />

          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600 tracking-wide group-hover:text-navy transition-colors">
                Overdue Dues
              </span>
              <div className="w-8 h-8 rounded-lg bg-brand-500/10 border border-brand-500/20 text-brand-600 flex items-center justify-center group-hover:scale-105 transition-transform shadow-2xs">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-3 flex items-baseline">
              <span className="text-3xl font-bold text-navy tracking-tight">
                <AnimatedNumber value={totalOverdue} prefix="Rs. " />
              </span>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 mt-4 font-normal flex items-center justify-between border-t border-slate-100 pt-3 gap-2">
            <div
              className="flex items-center gap-1.5 flex-1 min-w-0"
              title={
                totalOverdue > 0
                  ? `${residentRoster.filter((r) => r.isOverdue).length} units overdue · Automated WhatsApp reminders dispatched`
                  : 'All maintenance dues cleared · Zero outstanding balance'
              }
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${totalOverdue > 0 ? 'bg-red-500' : 'bg-emerald-500'}`} />
              <CircularMarqueeText
                text={
                  totalOverdue > 0
                    ? `${residentRoster.filter((r) => r.isOverdue).length} units overdue · Automated WhatsApp reminders dispatched`
                    : 'All maintenance dues cleared · Zero outstanding balance'
                }
              />
            </div>
            <span className="text-brand-600 font-semibold group-hover:translate-x-0.5 transition-transform shrink-0">
              Filter overdue →
            </span>
          </div>
        </div>

        {/* Card 3: Pending Verification */}
        <div
          onClick={() => setSelectedStatus('Unpaid')}
          className="relative overflow-hidden bg-gradient-to-b from-white to-slate-50/50 p-5 rounded-xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)] hover:border-slate-300 hover:-translate-y-0.5 transition-transform transition-shadow duration-200 group flex flex-col justify-between cursor-pointer"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-brand-500/5 rounded-full blur-xl pointer-events-none -mr-4 -mt-4" />

          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600 tracking-wide group-hover:text-navy transition-colors">
                Pending Verification
              </span>
              <div className="w-8 h-8 rounded-lg bg-brand-500/10 border border-brand-500/20 text-brand-600 flex items-center justify-center group-hover:scale-105 transition-transform shadow-2xs">
                <Receipt className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-3 flex items-baseline">
              <span className="text-3xl font-bold text-navy tracking-tight">
                <AnimatedNumber value={pendingReceiptsCount} />
              </span>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 mt-4 font-normal flex items-center justify-between border-t border-slate-100 pt-3 gap-2">
            <div
              className="flex items-center gap-1.5 flex-1 min-w-0"
              title={
                pendingReceiptsCount > 0
                  ? `${pendingReceiptsCount} resident payment slips awaiting review · WhatsApp verification queue`
                  : 'All resident payment slips verified · Up to date'
              }
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${pendingReceiptsCount > 0 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
              <CircularMarqueeText
                text={
                  pendingReceiptsCount > 0
                    ? `${pendingReceiptsCount} resident payment slips awaiting review · WhatsApp verification queue`
                    : 'All resident payment slips verified · Up to date'
                }
              />
            </div>
            <span className="text-brand-600 font-semibold group-hover:translate-x-0.5 transition-transform shrink-0">
              Verify receipts →
            </span>
          </div>
        </div>

        {/* Card 4: Collection Rate */}
        <div
          onClick={() => setSelectedStatus('All')}
          className="relative overflow-hidden bg-gradient-to-b from-white to-slate-50/50 p-5 rounded-xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)] hover:border-slate-300 hover:-translate-y-0.5 transition-transform transition-shadow duration-200 group flex flex-col justify-between cursor-pointer"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-brand-500/5 rounded-full blur-xl pointer-events-none -mr-4 -mt-4" />

          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600 tracking-wide group-hover:text-navy transition-colors">
                Collection Rate
              </span>
              <div className="w-8 h-8 rounded-lg bg-brand-500/10 border border-brand-500/20 text-brand-600 flex items-center justify-center group-hover:scale-105 transition-transform shadow-2xs">
                <Percent className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-3 flex items-baseline">
              <span className="text-3xl font-bold text-navy tracking-tight">
                <AnimatedNumber value={collectionRate} suffix="%" />
              </span>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 mt-4 font-normal flex items-center justify-between border-t border-slate-100 pt-3 gap-2">
            <div
              className="flex items-center gap-1.5 flex-1 min-w-0"
              title={`${paidUnitsCount} of ${residentRoster.length} units settled for current cycle · High collection health`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0" />
              <CircularMarqueeText text={`${paidUnitsCount} of ${residentRoster.length} units settled for current cycle · High collection health`} />
            </div>
            <span className="text-brand-600 font-semibold group-hover:translate-x-0.5 transition-transform shrink-0">
              View roster →
            </span>
          </div>
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
              Resident Maintenance Accounts {loading ? '' : `(${filteredResidentRoster.length} Units)`}
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">Full Resident Ledger & Collector Accountability</span>
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
                      <span className="text-xs font-medium text-slate-600">Loading society resident accounts...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredResidentRoster.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    No resident accounts found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredResidentRoster.map((r) => {
                  const isSettled = r.isSettled;
                  const arrears = r.arrears;
                  const totalDue = r.totalBalanceDue;
                  const baseFee = r.latestBaseFee;
                  const delivery = r.delivery;
                  const collector = r.collector;
                  const collectionTime = r.collectionTime;

                  return (
                    <tr
                      key={r.id}
                      onClick={() => handleOpenHistoryModal(r)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      title="Click row to view complete billing & payment ledger for this resident"
                    >
                      {/* Resident & Unit */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div>
                            <p className="font-bold text-navy group-hover:text-brand-600 transition-colors flex items-center gap-1.5">
                              {r.residentName}
                              <span className="text-[10px] text-brand-600 opacity-0 group-hover:opacity-100 transition-opacity font-normal">
                                (View Ledger →)
                              </span>
                            </p>
                            <p className="text-[10px] text-slate-500 font-mono">
                              {r.building} - Unit {r.unitNumber} {r.phoneNumber && `· ${r.phoneNumber}`}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Monthly Due & Arrears */}
                      <td className="px-4 py-3 font-mono font-bold text-navy text-sm">
                        <div>
                          {isSettled ? (
                            <span className="text-emerald-700 font-semibold text-xs">Rs. 0 (All Cleared)</span>
                          ) : (
                            `Rs. ${totalDue.toLocaleString()}`
                          )}
                        </div>
                        {arrears > 0 && !isSettled && (
                          <span
                            className="inline-flex items-center gap-0.5 text-[10px] text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-medium mt-0.5"
                            title={`Current Cycle: Rs. ${baseFee.toLocaleString()} + Prior Arrears: Rs. ${arrears.toLocaleString()}`}
                          >
                            + Rs. ${arrears.toLocaleString()} Arrears
                          </span>
                        )}
                        {!isSettled && arrears === 0 && (
                          <span className="text-[10px] text-slate-400 font-normal block">
                            Current: Rs. {baseFee.toLocaleString()}
                          </span>
                        )}
                      </td>

                      {/* Due Date */}
                      <td className="px-4 py-3 text-slate-600">
                        <div>{r.dueDate}</div>
                        <span className="text-[10px] text-slate-400">Latest cycle</span>
                      </td>

                      {/* WhatsApp Delivery Status Column */}
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
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
                              onClick={() => handleResendSingle(r.latestInvoice?.id)}
                              disabled={resendingId === r.latestInvoice?.id}
                              className="p-1 text-slate-500 hover:text-brand-600 hover:bg-slate-100 rounded transition-colors disabled:opacity-50"
                              title="Resend WhatsApp voucher to this unit"
                            >
                              <RotateCw className={`w-3.5 h-3.5 ${resendingId === r.latestInvoice?.id ? 'animate-spin text-brand-600' : ''}`} />
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px] font-medium">— Pending</span>
                        )}
                      </td>

                      {/* Payment Status with Collector & Timestamp Accountability */}
                      <td className="px-4 py-3">
                        {r.effectiveStatus === 'verified' ? (
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
                        ) : r.effectiveStatus === 'paid' ? (
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
                        ) : r.effectiveStatus === 'pending_verification' ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                              <Clock className="w-3 h-3 text-blue-600" /> PENDING REVIEW
                            </span>
                            <p className="text-[10px] text-slate-500">Slip uploaded via WhatsApp</p>
                          </div>
                        ) : r.effectiveStatus === 'overdue' ? (
                          <div className="space-y-0.5">
                            <span className="status-pill status-pill-overdue">OVERDUE</span>
                            {arrears > 0 && (
                              <p className="text-[10px] text-red-600 font-medium">+ Arrears Unpaid</p>
                            )}
                          </div>
                        ) : (
                          <span className="status-pill status-pill-unpaid">UNPAID</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          {/* Ledger History Button */}
                          <button
                            onClick={() => handleOpenHistoryModal(r)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded border border-slate-300 flex items-center gap-1 transition-colors"
                            title="View complete billing & payment ledger for this resident"
                          >
                            <History className="w-3 h-3 text-slate-600" />
                            <span>Ledger</span>
                          </button>

                          {/* Receipt Preview if pending */}
                          {r.hasPendingReceipt && r.pendingInvoice && (
                            <button
                              onClick={() => {
                                setSelectedInvoice(r.pendingInvoice);
                                setShowReceiptModal(true);
                              }}
                              className={`px-2.5 py-1 rounded border transition-colors flex items-center gap-1 font-semibold ${
                                r.pendingInvoice.payment_audit?.flag === 'suspected_fraud'
                                  ? 'bg-red-50 text-red-700 hover:bg-red-100 border-red-300 shadow-xs'
                                  : r.pendingInvoice.payment_audit?.is_partial
                                  ? 'bg-amber-50 text-amber-800 hover:bg-amber-100 border-amber-300 shadow-xs'
                                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200'
                              }`}
                              title="Review uploaded WhatsApp payment slip"
                            >
                              {r.pendingInvoice.payment_audit?.flag === 'suspected_fraud' ? (
                                <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                              ) : r.pendingInvoice.payment_audit?.is_partial ? (
                                <Clock className="w-3.5 h-3.5 text-amber-600" />
                              ) : (
                                <Eye className="w-3.5 h-3.5" />
                              )}
                              <span>
                                {r.pendingInvoice.payment_audit?.flag === 'suspected_fraud'
                                  ? 'Flagged'
                                  : r.pendingInvoice.payment_audit?.is_partial
                                  ? 'Partial'
                                  : 'Review Slip'}
                              </span>
                            </button>
                          )}

                          {/* Mark Paid Action Button (Opens Collector modal) */}
                          {!isSettled ? (
                            <button
                              onClick={() => handleOpenMarkPaidModal(r.latestInvoice)}
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
        <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
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
        <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
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

              {/* AI Security Fraud Alert Banner if Flagged */}
              {selectedInvoice.payment_audit?.flag === 'suspected_fraud' && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-900 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>AI Security Warning: Suspected Image Alteration</span>
                  </div>
                  <p className="text-[11px] text-red-700 leading-relaxed">
                    {selectedInvoice.payment_audit?.reason || 'The visual scanner detected potential signs of digital editing or altered digits on this screenshot.'}
                  </p>
                  <p className="text-[10px] text-red-600 font-semibold pt-0.5">
                    Carefully cross-check the transaction reference in your society bank statement before approving.
                  </p>
                </div>
              )}

              {/* Bank Statement Cross-Check & Reconciliation Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                    <Building className="w-4 h-4 text-brand-600" />
                    Society Bank Statement Cross-Check
                  </span>
                  {selectedInvoice.payment_audit?.is_partial ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                      Partial (Rem: Rs. {Number(selectedInvoice.payment_audit.remaining_balance || 0).toLocaleString()})
                    </span>
                  ) : selectedInvoice.payment_audit?.reference_number ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Details Extracted
                    </span>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">TxID / Reference</span>
                    <span className="font-mono font-bold text-slate-800 select-all">
                      {selectedInvoice.payment_audit?.reference_number || 'See receipt image'}
                    </span>
                  </div>

                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Amount on Slip</span>
                    <span className="font-mono font-bold text-emerald-700 text-xs">
                      Rs. {Number(selectedInvoice.payment_audit?.this_slip_amount || selectedInvoice.payment_audit?.amount_paid || selectedInvoice.totalAmount || selectedInvoice.total_amount || 0).toLocaleString()}
                    </span>
                  </div>

                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Transaction Date</span>
                    <span className="font-medium text-slate-700">
                      {selectedInvoice.payment_audit?.payment_date || 'Check receipt'}
                    </span>
                  </div>

                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Bank / Channel</span>
                    <span className="font-medium text-slate-700">
                      {selectedInvoice.payment_audit?.bank_or_app || 'Bank Transfer'}
                    </span>
                  </div>
                </div>

                {/* Beneficiary Match */}
                <div className="bg-white p-2 rounded-lg border border-slate-200 text-[11px] flex items-center justify-between">
                  <div className="truncate mr-2">
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Beneficiary Account</span>
                    <span className="font-mono text-slate-700 text-[10px] truncate block" title={selectedInvoice.payment_audit?.destination_account || selectedInvoice.account_shown}>
                      {selectedInvoice.payment_audit?.destination_account || selectedInvoice.account_shown || 'Society Maintenance Account'}
                    </span>
                  </div>
                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px] font-semibold border border-emerald-200 shrink-0">
                    Matched
                  </span>
                </div>

                {/* Linked Partial Slips History if multiple slips exist */}
                {selectedInvoice.payment_audit?.partial_payments && selectedInvoice.payment_audit.partial_payments.length > 1 && (
                  <div className="mt-2 pt-2 border-t border-slate-200">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                      All Receipts Linked ({selectedInvoice.payment_audit.partial_payments.length}):
                    </span>
                    <div className="space-y-1">
                      {selectedInvoice.payment_audit.partial_payments.map((p, idx) => (
                        <div key={idx} className="flex items-center justify-between text-[10px] bg-slate-100/70 p-1.5 rounded">
                          <span className="font-mono text-slate-700">Slip #{idx + 1}: {p.reference_number || 'N/A'}</span>
                          <span className="font-bold font-mono text-emerald-700">Rs. {Number(p.amount || 0).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
                <span>Approve & Mark Verified</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: EXPORT STATEMENT OF COLLECTION */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden my-auto">
            {/* Pinned Header */}
            <div className="p-4 sm:p-5 bg-navy text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-base flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-brand-400" /> Export Statement of Collection
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Generate official collection ledgers, audit statements, and spreadsheet reports.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-4 sm:p-5 space-y-4 text-xs overflow-y-auto flex-1">
              {/* Filter / Scope Controls */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Filter className="w-3.5 h-3.5 text-brand-600" /> Payment Status Scope
                  </label>
                  <select
                    value={exportStatus}
                    onChange={(e) => setExportStatus(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded font-medium bg-white text-slate-800 text-xs focus:ring-1 focus:ring-navy focus:outline-none"
                  >
                    <option value="All">All Vouchers ({invoices.length})</option>
                    <option value="Paid">Paid & Verified Only</option>
                    <option value="Unpaid">Unpaid / Outstanding Only</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Building className="w-3.5 h-3.5 text-brand-600" /> Building / Block
                  </label>
                  <select
                    value={exportBuilding}
                    onChange={(e) => setExportBuilding(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded font-medium bg-white text-slate-800 text-xs focus:ring-1 focus:ring-navy focus:outline-none"
                  >
                    {availableBuildings.map((b) => (
                      <option key={b} value={b}>
                        {b === 'All' ? 'All Buildings / Blocks' : b}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Live Statement Preview Card */}
              <div className="border border-slate-200 rounded-xl p-4 bg-gradient-to-br from-slate-50 to-white shadow-2xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="font-bold text-navy text-xs uppercase tracking-wider">
                    Statement Summary Preview
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    Due Date: {voucherForm.due_date}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block">Assessed Units</span>
                    <span className="text-base font-bold text-navy font-mono">{exportInvoices.length}</span>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block">Total Assessed</span>
                    <span className="text-sm font-bold text-navy font-mono">
                      Rs. {exportTotalBilled.toLocaleString()}
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block">Collections Realized</span>
                    <span className="text-sm font-bold text-emerald-600 font-mono">
                      Rs. {exportTotalCollected.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Outstanding & Collection Rate Bar */}
                <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 font-medium">Outstanding Dues to Collect:</span>
                    <span
                      className={`font-mono font-bold ${
                        exportTotalOutstanding > 0 ? 'text-amber-700' : 'text-emerald-700'
                      }`}
                    >
                      Rs. {exportTotalOutstanding.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                      <span>Collection Efficiency</span>
                      <span className="font-bold text-slate-800">{exportRate}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.max(0, parseFloat(exportRate)))}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Approved Tariff Pill */}
                <div className="text-[11px] text-slate-600 bg-slate-100/70 p-2.5 rounded-lg border border-slate-200/80 flex items-center justify-between">
                  <span>
                    Unit Tariff: <strong>Rs. {totalMaintenanceFee.toLocaleString()}</strong> / month
                  </span>
                  <span
                    className="font-mono text-[10px] text-slate-500 truncate max-w-[200px]"
                    title={voucherForm.account_shown}
                  >
                    {voucherForm.account_shown}
                  </span>
                </div>
              </div>

              {/* Roster preview list */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="font-bold text-slate-700 text-xs">
                    Included Residents & Apartments ({exportInvoices.length}):
                  </span>
                  <span className="text-[10px] text-slate-400">All rows will be exported</span>
                </div>
                <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white">
                  {exportInvoices.length === 0 ? (
                    <div className="p-4 text-center text-slate-400 text-xs">
                      No records match the selected scope.
                    </div>
                  ) : (
                    exportInvoices.map((inv) => {
                      const res = inv.residents || {};
                      const bld = inv.building || res.building || 'Block A';
                      const unit = inv.unitNumber || res.unit_number || '';
                      const name = inv.residentName || res.name || 'Resident';
                      const st = (inv.status || 'unpaid').toLowerCase();
                      const isPaid = st === 'paid' || st === 'verified';
                      const total = Number(
                        inv.totalAmount ||
                          inv.total_amount ||
                          inv.societyMaintenanceFee ||
                          inv.society_maintenance_fee ||
                          0
                      );

                      return (
                        <div
                          key={inv.id}
                          className="p-2 px-3 flex items-center justify-between hover:bg-slate-50 text-[11px]"
                        >
                          <div>
                            <span className="font-bold text-slate-800">{name}</span>
                            <span className="text-slate-400 font-mono text-[10px] ml-1.5">
                              ({bld} - Unit {unit})
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-navy">
                              Rs. {total.toLocaleString()}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                isPaid
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {isPaid ? 'Paid' : 'Unpaid'}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Pinned Footer with Both Export Actions */}
            <div className="p-4 border-t border-slate-200 bg-slate-50/80 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="w-full sm:w-auto px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-medium rounded-lg transition-colors text-xs"
              >
                Cancel
              </button>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                {/* Action 1: Download CSV / Excel */}
                <button
                  type="button"
                  onClick={handleDownloadCsv}
                  disabled={isExportingCsv || exportInvoices.length === 0}
                  className="flex-1 sm:flex-initial px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-xs flex items-center justify-center gap-1.5 transition-colors text-xs disabled:opacity-50"
                  title="Download Microsoft Excel / Google Sheets CSV"
                >
                  <Download className={`w-3.5 h-3.5 ${isExportingCsv ? 'animate-bounce' : ''}`} />
                  <span>{isExportingCsv ? 'Exporting...' : 'Download CSV / Excel'}</span>
                </button>

                {/* Action 2: Print / Save PDF Statement */}
                <button
                  type="button"
                  onClick={handlePrintPdfStatement}
                  disabled={exportInvoices.length === 0}
                  className="flex-1 sm:flex-initial px-3.5 py-2 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-lg shadow-xs flex items-center justify-center gap-1.5 transition-colors text-xs disabled:opacity-50"
                  title="Open executive printable statement and Save as PDF"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print / Save PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RESIDENT PAYMENT HISTORY & LEDGER */}
      {showHistoryModal && selectedResidentForHistory && (() => {
        const rawHistory = residentHistoryData?.history || [];
        const filteredHistory = rawHistory.filter((item) => {
          const st = (item.status || '').toLowerCase();
          const isPaid = st === 'paid' || st === 'verified';
          const hasReceipt = Boolean(item.receipt_image_url);

          if (historyFilter === 'Paid') return isPaid;
          if (historyFilter === 'Unpaid') return !isPaid;
          if (historyFilter === 'Receipts') return hasReceipt;
          return true; // 'All'
        });

        const resProfile = residentHistoryData?.resident || selectedResidentForHistory;
        const summary = residentHistoryData?.summary || {
          total_billed: selectedResidentForHistory.latestBaseFee,
          total_paid: 0,
          balance_due: selectedResidentForHistory.totalBalanceDue,
          total_cycles: rawHistory.length,
          paid_cycles: rawHistory.filter((h) => h.status === 'paid' || h.status === 'verified').length,
          overdue_cycles: rawHistory.filter((h) => h.status === 'overdue').length,
          unpaid_cycles: rawHistory.filter((h) => h.status === 'unpaid').length,
        };

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden my-auto">
              {/* Header */}
              <div className="p-4 sm:p-5 bg-navy text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand-500/20 border border-brand-400/30 flex items-center justify-center font-bold text-sm text-brand-300">
                    {(resProfile.name || selectedResidentForHistory.residentName || 'RE')
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-base text-white">
                        {resProfile.name || selectedResidentForHistory.residentName}
                      </h3>
                      <span className="text-[11px] font-mono bg-white/10 px-2 py-0.5 rounded text-slate-200">
                        {resProfile.building || selectedResidentForHistory.building} · Unit{' '}
                        {resProfile.unit_number || selectedResidentForHistory.unitNumber}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 font-mono mt-0.5">
                      WhatsApp: {resProfile.phone_number || selectedResidentForHistory.phoneNumber || '—'} · Resident Billing Ledger
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowHistoryModal(false);
                    setSelectedResidentForHistory(null);
                  }}
                  className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-slate-50/50">
                {/* 3 Summary KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[11px] uppercase font-semibold text-slate-500 block">
                      Lifetime Assessed
                    </span>
                    <span className="text-xl font-bold text-navy font-mono">
                      Rs. {Number(summary.total_billed || 0).toLocaleString()}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      {summary.total_cycles || rawHistory.length} total billing cycle(s)
                    </span>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[11px] uppercase font-semibold text-slate-500 block">
                      Total Realized Collections
                    </span>
                    <span className="text-xl font-bold text-emerald-600 font-mono">
                      Rs. {Number(summary.total_paid || 0).toLocaleString()}
                    </span>
                    <span className="text-[10px] text-emerald-600/80 block mt-0.5">
                      {summary.paid_cycles || 0} settled cycle(s)
                    </span>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[11px] uppercase font-semibold text-slate-500 block">
                      Current Outstanding Balance
                    </span>
                    <span
                      className={`text-xl font-bold font-mono ${
                        (summary.balance_due || 0) > 0 ? 'text-red-600' : 'text-emerald-600'
                      }`}
                    >
                      Rs. {Number(summary.balance_due || 0).toLocaleString()}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      {(summary.balance_due || 0) > 0 ? 'Action required' : 'All dues cleared'}
                    </span>
                  </div>
                </div>

                {/* Filter Tabs & History Counter */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-1.5 overflow-x-auto">
                    {[
                      { id: 'All', label: 'All Cycles', count: rawHistory.length },
                      {
                        id: 'Paid',
                        label: 'Paid & Verified',
                        count: rawHistory.filter((h) => h.status === 'paid' || h.status === 'verified')
                          .length,
                      },
                      {
                        id: 'Unpaid',
                        label: 'Unpaid & Overdue',
                        count: rawHistory.filter((h) => h.status !== 'paid' && h.status !== 'verified')
                          .length,
                      },
                      {
                        id: 'Receipts',
                        label: 'With Receipts',
                        count: rawHistory.filter((h) => Boolean(h.receipt_image_url)).length,
                      },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setHistoryFilter(tab.id)}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                          historyFilter === tab.id
                            ? 'bg-navy text-white shadow-xs'
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <span>{tab.label}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                            historyFilter === tab.id
                              ? 'bg-white/20 text-white'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {tab.count}
                        </span>
                      </button>
                    ))}
                  </div>

                  <span className="text-xs text-slate-500 font-medium">
                    Showing {filteredHistory.length} of {rawHistory.length} cycle(s)
                  </span>
                </div>

                {/* History Table */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100/80 text-slate-600 uppercase font-semibold border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3">Billing Period / Due</th>
                        <th className="px-4 py-3">Billed (PKR)</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Payment Mode & Proof</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {historyLoading ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                            <div className="flex flex-col items-center justify-center gap-2">
                              <RefreshCw className="w-5 h-5 text-brand-600 animate-spin" />
                              <span className="text-xs font-medium">Loading resident payment ledger...</span>
                            </div>
                          </td>
                        </tr>
                      ) : filteredHistory.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                            No billing cycles found for this filter.
                          </td>
                        </tr>
                      ) : (
                        filteredHistory.map((item) => {
                          const isSettled = item.status === 'paid' || item.status === 'verified';
                          const isOverdue = item.status === 'overdue';
                          const baseFee = Number(item.society_maintenance_fee || 0);
                          const arrears = Number(item.arrears || 0);
                          const total = Number(item.total_payable || baseFee + arrears);
                          const hasReceipt = Boolean(item.receipt_image_url);

                          return (
                            <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                              {/* Period / Due Date */}
                              <td className="px-4 py-3">
                                <div className="font-bold text-slate-800">
                                  Due: {item.due_date || 'N/A'}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  Inv #{item.id?.slice(0, 8)}...
                                </div>
                              </td>

                              {/* Billed PKR */}
                              <td className="px-4 py-3 font-mono font-bold text-navy text-sm">
                                <div>Rs. {total.toLocaleString()}</div>
                                {arrears > 0 && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded font-medium mt-0.5">
                                    + Rs. {arrears.toLocaleString()} Arrears
                                  </span>
                                )}
                              </td>

                              {/* Status Badge */}
                              <td className="px-4 py-3">
                                {item.status === 'verified' ? (
                                  <span className="status-pill status-pill-paid flex items-center gap-1 w-fit">
                                    <CheckCircle2 className="w-3 h-3" /> VERIFIED
                                  </span>
                                ) : item.status === 'paid' ? (
                                  <span className="status-pill status-pill-paid flex items-center gap-1 w-fit">
                                    <Check className="w-3 h-3" /> PAID
                                  </span>
                                ) : isOverdue ? (
                                  <span className="status-pill status-pill-overdue">OVERDUE</span>
                                ) : (
                                  <span className="status-pill status-pill-unpaid">UNPAID</span>
                                )}
                              </td>

                              {/* Payment Mode & Proof */}
                              <td className="px-4 py-3">
                                {item.status === 'verified' || item.payment_method === 'WhatsApp Slip' || hasReceipt ? (
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1.5">
                                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                        🏦 Bank Transfer / Slip
                                      </span>
                                      {item.payment_audit?.flag === 'suspected_fraud' && (
                                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-red-700 bg-red-50 px-1.5 py-0.2 rounded border border-red-200">
                                          ⚠️ Flagged
                                        </span>
                                      )}
                                    </div>
                                    {item.reference_number && (
                                      <p className="text-[10px] text-slate-600 font-mono">
                                        TxID: <strong className="text-slate-800">{item.reference_number}</strong>
                                      </p>
                                    )}
                                    {hasReceipt && (
                                      <div className="flex items-center gap-2 pt-0.5">
                                        <button
                                          type="button"
                                          onClick={() => setPreviewReceiptUrl(item.receipt_image_url)}
                                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:text-brand-800 bg-brand-50 hover:bg-brand-100 px-2 py-0.5 rounded border border-brand-200 transition-colors"
                                          title="View screenshot uploaded via WhatsApp"
                                        >
                                          <Eye className="w-3 h-3" />
                                          <span>View Screenshot</span>
                                        </button>
                                        <img
                                          src={item.receipt_image_url}
                                          alt="thumbnail"
                                          onClick={() => setPreviewReceiptUrl(item.receipt_image_url)}
                                          className="w-6 h-6 object-cover rounded border border-slate-300 cursor-pointer hover:opacity-80"
                                        />
                                      </div>
                                    )}
                                    {item.collected_at && (
                                      <p className="text-[9px] text-slate-400 font-mono">
                                        Verified: {formatTimestamp(item.collected_at)}
                                      </p>
                                    )}
                                  </div>
                                ) : item.status === 'paid' || item.payment_method?.toLowerCase().includes('cash') ? (
                                  <div className="space-y-1">
                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                      💵 Cash Collected
                                    </span>
                                    {item.collector && (
                                      <p className="text-[10px] text-slate-600 flex items-center gap-1">
                                        <UserCheck className="w-3 h-3 text-slate-400 shrink-0" />
                                        <span>
                                          Collector: <strong className="text-slate-800">{item.collector}</strong>
                                        </span>
                                      </p>
                                    )}
                                    {item.collected_at && (
                                      <p className="text-[9px] text-slate-400 font-mono">
                                        {formatTimestamp(item.collected_at)}
                                      </p>
                                    )}
                                  </div>
                                ) : item.payment_method === 'Settled via Arrears Voucher' ? (
                                  <div className="space-y-0.5">
                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-800 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                                      Cleared via Subsequent Voucher
                                    </span>
                                    <p className="text-[9px] text-slate-400">Included in arrears</p>
                                  </div>
                                ) : (
                                  <div>
                                    <span className="text-slate-400 text-xs italic">Awaiting payment</span>
                                  </div>
                                )}
                              </td>

                              {/* Actions */}
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {hasReceipt && !isSettled && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenReceiptForHistory(item)}
                                      className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded border border-blue-200 text-xs flex items-center gap-1 transition-colors"
                                      title="Review and approve uploaded receipt"
                                    >
                                      <Eye className="w-3 h-3" />
                                      <span>Verify Slip</span>
                                    </button>
                                  )}

                                  {!isSettled ? (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenMarkPaidForHistory(item)}
                                      className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold rounded border border-emerald-200 text-xs flex items-center gap-1 transition-colors"
                                      title="Record payment collection for this cycle"
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

              {/* Pinned Footer */}
              <div className="p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                <div className="text-xs text-slate-500">
                  <span>Showing itemized payment receipts & cash collector audit trail</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowHistoryModal(false);
                    setSelectedResidentForHistory(null);
                  }}
                  className="w-full sm:w-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-semibold rounded-lg text-xs transition-colors"
                >
                  Close Ledger
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL: FULL RECEIPT SCREENSHOT LIGHTBOX */}
      {previewReceiptUrl && (
        <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-300">
            <div className="p-3.5 bg-navy text-white flex items-center justify-between shrink-0">
              <h4 className="font-bold text-sm flex items-center gap-2">
                <Eye className="w-4 h-4 text-brand-400" /> WhatsApp Payment Receipt Screenshot
              </h4>
              <button
                type="button"
                onClick={() => setPreviewReceiptUrl(null)}
                className="text-white/80 hover:text-white p-1 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-slate-900 flex items-center justify-center min-h-[300px]">
              <img
                src={previewReceiptUrl}
                alt="Payment Receipt"
                className="max-h-[65vh] w-auto object-contain rounded shadow-lg"
              />
            </div>
            <div className="p-3 bg-slate-100 border-t border-slate-200 flex justify-between items-center text-xs shrink-0">
              <a
                href={previewReceiptUrl}
                target="_blank"
                rel="noreferrer"
                className="text-brand-600 hover:underline flex items-center gap-1 font-semibold"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Open high-resolution in new tab
              </a>
              <button
                type="button"
                onClick={() => setPreviewReceiptUrl(null)}
                className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
