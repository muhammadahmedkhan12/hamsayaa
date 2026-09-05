import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Ticket,
  AlertTriangle,
  Car,
  TrendingUp,
  MessageSquare,
  ShieldAlert,
  Clock,
  CheckCircle2,
  Building,
  User,
  RefreshCw,
  Zap
} from 'lucide-react';
import { fetchDashboardSummary } from '../services/api';

// Horizontal ping-pong scrolling text when text overflows container
function PingPongText({ text }) {
  const containerRef = useRef(null);
  const textRef = useRef(null);
  const [overflowDist, setOverflowDist] = useState(0);

  useEffect(() => {
    const calculateOverflow = () => {
      if (containerRef.current && textRef.current) {
        const diff = textRef.current.scrollWidth - containerRef.current.clientWidth;
        setOverflowDist(diff > 2 ? diff + 8 : 0);
      }
    };

    calculateOverflow();
    const timer = setTimeout(calculateOverflow, 300);
    window.addEventListener('resize', calculateOverflow);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', calculateOverflow);
    };
  }, [text]);

  return (
    <div ref={containerRef} className="overflow-hidden whitespace-nowrap mask-fade-right flex-1 min-w-0">
      <span
        ref={textRef}
        className="inline-block whitespace-nowrap"
        style={
          overflowDist > 0
            ? {
                animation: `pingpong-scroll ${Math.max(5, overflowDist * 0.08 + 4.5)}s ease-in-out infinite`,
                '--scroll-dist': `-${overflowDist}px`
              }
            : {}
        }
      >
        {text}
      </span>
    </div>
  );
}

// Smooth easing count-up animation for metrics
function AnimatedNumber({ value, duration = 650, prefix = '' }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTimestamp = null;
    const startValue = 0;
    const endValue = typeof value === 'number' ? value : parseFloat(value) || 0;

    if (endValue === 0) {
      setDisplayValue(0);
      return;
    }

    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // Ease-out cubic
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
    </span>
  );
}

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardMetrics();
  }, []);

  const loadDashboardMetrics = async () => {
    setLoading(true);
    const data = await fetchDashboardSummary();
    setSummary(data);
    setLoading(false);
  };

  const openTickets = summary?.open_tickets_count ?? 0;
  const humanReview = summary?.needs_human_review_count ?? 0;
  const overdueTotal = summary?.overdue_dues_total ?? 0;
  const overdueCount = summary?.overdue_count ?? 0;
  const activePasses = summary?.active_passes_count ?? 0;
  const flaggedOverstays = summary?.flagged_overstays_count ?? 0;
  const complaints = summary?.recent_complaints ?? [];
  const overdueInvoices = summary?.overdue_invoices ?? [];
  const activeVisitorPasses = summary?.active_passes ?? [];
  const flaggedVehicles = summary?.flagged_overstays ?? (summary?.vehicle_logs?.filter(v => v.is_flagged_overstay || v.isFlaggedOverstay) ?? []);
  const vehicleLogs = summary?.vehicle_logs ?? [];

  // Meaningful context snippet for Card 1 (Open Tickets)
  const latestComplaint = complaints[0];
  const latestTicketInfo = latestComplaint
    ? `Latest: ${latestComplaint.category || 'Issue'} (Unit ${latestComplaint.residents?.unit_number || latestComplaint.unit || '221'} · Ticket ${latestComplaint.ticket_number || latestComplaint.id || 'Open'})`
    : 'WhatsApp AI active · 0 open issues';

  // Meaningful context snippet for Card 2 (Overdue Dues)
  const oldestOverdue = overdueInvoices[0];
  const overdueInfo = oldestOverdue
    ? `Oldest overdue: Unit ${oldestOverdue.residents?.unit_number || oldestOverdue.unitNumber || '222'} (Rs. ${Number(oldestOverdue.total_amount || oldestOverdue.totalAmount || 0).toLocaleString()} · Due ${oldestOverdue.due_date || oldestOverdue.dueDate || 'Past Due'})`
    : overdueCount > 0
    ? `${overdueCount} units overdue · Total Rs. ${overdueTotal.toLocaleString()}`
    : 'All maintenance dues cleared · 0 overdue';

  // Meaningful context snippet for Card 3 (Active Guest Passes)
  const latestPass = activeVisitorPasses[0];
  const activePassInfo = latestPass
    ? `Active: ${latestPass.visitor_name || latestPass.visitorName || 'Guest'} (${latestPass.vehicle_plate || latestPass.vehiclePlate || 'Gate'} · Unit ${latestPass.residents?.unit_number || latestPass.unit || '221'} · Pass ${latestPass.pass_code || latestPass.code || 'VP'})`
    : activePasses > 0
    ? `${activePasses} guest passes active at gate`
    : 'Gate security active · 0 visitor passes';

  // Meaningful context snippet for Card 4 (Flagged Overstays)
  const latestOverstay = flaggedVehicles[0];
  const overstayInfo = latestOverstay
    ? `Flagged overstay: ${latestOverstay.vehicle_plate || latestOverstay.vehiclePlate || 'Vehicle'} (Exceeded pass limit · 0-min grace policy · Security notified)`
    : flaggedOverstays > 0
    ? `${flaggedOverstays} visitor vehicles exceeding allowed duration`
    : 'Security active · All visitor gates clear';

  // Skeleton shimmer block
  const Skeleton = ({ className = '' }) => (
    <div className={`animate-pulse bg-slate-200 rounded ${className}`} />
  );

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-navy tracking-tight">Society Operations Overview</h1>
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
              <Skeleton className="h-8 w-16 mt-2" />
              <Skeleton className="h-3 w-32 mt-1" />
            </div>
          ))}
        </div>

        {/* Skeleton Split View */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white rounded-lg border border-surface-border shadow-sm overflow-hidden">
              <div className="p-4 border-b border-surface-border bg-slate-50/50">
                <Skeleton className="h-4 w-48" />
              </div>
              <div className="divide-y divide-slate-100">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-5 w-20" />
                        <Skeleton className="h-4 w-36" />
                      </div>
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </div>
                    <Skeleton className="h-3 w-full" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy tracking-tight">Society Operations Overview</h1>
          <p className="text-sm text-slate-500 mt-0.5">Real-time gate traffic, AI ticket queue, and financial dues ledger.</p>
        </div>

        <button
          onClick={loadDashboardMetrics}
          className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-medium text-xs rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-brand-600' : ''}`} />
          <span>Refresh Live Data</span>
        </button>
      </div>

      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Open Tickets (Rich Aesthetic Redesign) */}
        <Link
          to="/complaints"
          className="relative overflow-hidden bg-gradient-to-b from-white to-slate-50/50 p-5 rounded-xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)] hover:border-slate-300 hover:-translate-y-0.5 transition-all duration-200 group flex flex-col justify-between"
        >
          {/* Subtle top-right ambient warmth */}
          <div className="absolute top-0 right-0 w-24 h-24 bg-brand-500/5 rounded-full blur-xl pointer-events-none -mr-4 -mt-4" />

          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600 tracking-wide group-hover:text-navy transition-colors">
                Open Tickets
              </span>
              <div className="w-8 h-8 rounded-lg bg-brand-500/10 border border-brand-500/20 text-brand-600 flex items-center justify-center group-hover:scale-105 transition-transform shadow-2xs">
                <Ticket className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-3 flex items-baseline gap-3">
              <span className="text-3xl font-bold text-navy tracking-tight">
                <AnimatedNumber value={openTickets} />
              </span>
              {humanReview > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200/90 shadow-2xs">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                  </span>
                  {humanReview} review needed
                </span>
              )}
            </div>
          </div>

          <div className="text-[11px] text-slate-400 mt-4 font-normal flex items-center justify-between border-t border-slate-100 pt-3 gap-2">
            <div className="flex items-center gap-1.5 flex-1 min-w-0" title={latestTicketInfo}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <PingPongText text={latestTicketInfo} />
            </div>
            <span className="text-brand-600 font-semibold group-hover:translate-x-0.5 transition-transform shrink-0">
              View queue →
            </span>
          </div>
        </Link>

        {/* Card 2: Overdue Maintenance Dues */}
        <Link
          to="/invoices"
          className="relative overflow-hidden bg-gradient-to-b from-white to-slate-50/50 p-5 rounded-xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)] hover:border-slate-300 hover:-translate-y-0.5 transition-all duration-200 group flex flex-col justify-between"
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

            <div className="mt-3 flex items-baseline gap-2.5 flex-wrap">
              <span className="text-3xl font-bold text-navy tracking-tight">
                <AnimatedNumber value={overdueTotal} prefix="Rs." />
              </span>
              {overdueCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200/80">
                  {overdueCount} {overdueCount === 1 ? 'unit' : 'units'}
                </span>
              )}
            </div>
          </div>

          <div className="text-[11px] text-slate-400 mt-4 font-normal flex items-center justify-between border-t border-slate-100 pt-3 gap-2">
            <div className="flex items-center gap-1.5 flex-1 min-w-0" title={overdueInfo}>
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${overdueCount > 0 ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
              <PingPongText text={overdueInfo} />
            </div>
            <span className="text-brand-600 font-semibold group-hover:translate-x-0.5 transition-transform shrink-0">
              View invoices →
            </span>
          </div>
        </Link>

        {/* Card 3: Active Guest Passes */}
        <Link
          to="/vehicles"
          className="relative overflow-hidden bg-gradient-to-b from-white to-slate-50/50 p-5 rounded-xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)] hover:border-slate-300 hover:-translate-y-0.5 transition-all duration-200 group flex flex-col justify-between"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-brand-500/5 rounded-full blur-xl pointer-events-none -mr-4 -mt-4" />

          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600 tracking-wide group-hover:text-navy transition-colors">
                Active Guest Passes
              </span>
              <div className="w-8 h-8 rounded-lg bg-brand-500/10 border border-brand-500/20 text-brand-600 flex items-center justify-center group-hover:scale-105 transition-transform shadow-2xs">
                <Car className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-3 flex items-baseline gap-2.5">
              <span className="text-3xl font-bold text-navy tracking-tight">
                <AnimatedNumber value={activePasses} />
              </span>
              {activePasses > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-brand-50 text-brand-700 border border-brand-200/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                  Valid window
                </span>
              )}
            </div>
          </div>

          <div className="text-[11px] text-slate-400 mt-4 font-normal flex items-center justify-between border-t border-slate-100 pt-3 gap-2">
            <div className="flex items-center gap-1.5 flex-1 min-w-0" title={activePassInfo}>
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${activePasses > 0 ? 'bg-brand-500 animate-pulse' : 'bg-slate-300'}`} />
              <PingPongText text={activePassInfo} />
            </div>
            <span className="text-brand-600 font-semibold group-hover:translate-x-0.5 transition-transform shrink-0">
              Gate records →
            </span>
          </div>
        </Link>

        {/* Card 4: Flagged Overstay Vehicles */}
        <Link
          to="/vehicles"
          className="relative overflow-hidden bg-gradient-to-b from-white to-slate-50/50 p-5 rounded-xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)] hover:border-slate-300 hover:-translate-y-0.5 transition-all duration-200 group flex flex-col justify-between"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-brand-500/5 rounded-full blur-xl pointer-events-none -mr-4 -mt-4" />

          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600 tracking-wide group-hover:text-navy transition-colors">
                Flagged Overstays
              </span>
              <div className="w-8 h-8 rounded-lg bg-brand-500/10 border border-brand-500/20 text-brand-600 flex items-center justify-center group-hover:scale-105 transition-transform shadow-2xs">
                <ShieldAlert className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-3 flex items-baseline gap-2.5">
              <span className="text-3xl font-bold text-navy tracking-tight">
                <AnimatedNumber value={flaggedOverstays} />
              </span>
              {flaggedOverstays > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-red-50 text-red-800 border border-red-200/90 shadow-2xs">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </span>
                  0-min grace
                </span>
              )}
            </div>
          </div>

          <div className="text-[11px] text-slate-400 mt-4 font-normal flex items-center justify-between border-t border-slate-100 pt-3 gap-2">
            <div className="flex items-center gap-1.5 flex-1 min-w-0" title={overstayInfo}>
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${flaggedOverstays > 0 ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
              <PingPongText text={overstayInfo} />
            </div>
            <span className="text-brand-600 font-semibold group-hover:translate-x-0.5 transition-transform shrink-0">
              View overstays →
            </span>
          </div>
        </Link>
      </div>

      {/* Immediate Red Overstay Alert Banner */}
      {flaggedOverstays > 0 && (
        <div className="bg-red-600 text-white rounded-lg p-4 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-xs">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-sm">IMMEDIATE OVERSTAY ALERT ({flaggedOverstays} Visitor Vehicles Flagged)</h3>
              <p className="text-xs text-red-100 mt-0.5">Unregistered visitor vehicles have exceeded their pre-approved pass duration (0-minute grace policy).</p>
            </div>
          </div>

          <a
            href="/vehicles"
            className="px-4 py-2 bg-white text-red-700 hover:bg-red-50 font-bold text-xs rounded-lg shadow-sm whitespace-nowrap text-center transition-colors"
          >
            Review Overstays
          </a>
        </div>
      )}

      {/* Split-View Activity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Recent Complaints (Gemini AI Queue) */}
        <div className="bg-white rounded-lg border border-surface-border shadow-sm overflow-hidden">
          <div className="p-4 border-b border-surface-border bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-brand-600" />
              <h2 className="font-bold text-navy text-sm">Recent Complaints & Tickets</h2>
            </div>
            <Link to="/complaints" className="text-xs font-semibold text-brand-600 hover:text-brand-700">View All</Link>
          </div>

          <div className="divide-y divide-slate-100">
            {complaints.length > 0 ? (
              complaints.map((c, i) => {
                const ticketId = c.ticket_number || c.id || `TCK-10${i+1}`;
                const residentName = c.residents?.name || c.residentName || 'Resident';
                const unit = c.residents?.unit_number || c.unit || '101';
                const bld = c.residents?.building || 'Block A';
                const status = c.status || 'open';

                return (
                  <div key={i} className="p-4 hover:bg-slate-50/60 transition-colors space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-bold text-navy bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {ticketId}
                        </span>
                        <span className="text-xs font-bold text-slate-800">{bld} - Unit {unit} ({residentName})</span>
                      </div>

                      {status === 'needs_human_review' ? (
                        <span className="status-pill bg-amber-100 text-amber-800 border border-amber-300 font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-600" /> Needs Review
                        </span>
                      ) : status === 'resolved' ? (
                        <span className="status-pill status-pill-paid flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Resolved
                        </span>
                      ) : (
                        <span className="status-pill status-pill-unpaid">Open</span>
                      )}
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-2">
                      {(c.description || '').replace(/\[Audio:\s*https?:\/\/[^\]]+\]/gi, '').trim()}
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono">Category: {c.category || 'General'}</p>
                  </div>
                );
              })
            ) : (
              <div className="p-6 text-center text-xs text-slate-400">No active complaints found</div>
            )}
          </div>
        </div>

        {/* Right Column: Live Gate & Vehicle Entry Logs */}
        <div className="bg-white rounded-lg border border-surface-border shadow-sm overflow-hidden">
          <div className="p-4 border-b border-surface-border bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Car className="w-4 h-4 text-navy" />
              <h2 className="font-bold text-navy text-sm">Live Gate & Vehicle Logs</h2>
            </div>
            <a href="/vehicles" className="text-xs font-semibold text-brand-600 hover:text-brand-700">View Gate Logs</a>
          </div>

          <div className="divide-y divide-slate-100">
            {vehicleLogs.length > 0 ? (
              vehicleLogs.map((vl, i) => {
                const plate = vl.vehicle_plate || vl.vehiclePlate || 'KHI-0000';
                const visitor = vl.visitor_name || vl.visitorName || 'Visitor';
                const isOverstay = vl.is_flagged_overstay || vl.isFlaggedOverstay;
                const isRegistered = vl.is_registered || vl.isRegistered;

                return (
                  <div key={i} className="p-4 hover:bg-slate-50/60 transition-colors flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {plate}
                        </span>
                        <span className="text-xs font-semibold text-slate-700">{visitor}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-mono">Entry: {vl.entry_time || vl.entryTime || 'Today'}</p>
                    </div>

                    {isOverstay ? (
                      <span className="status-pill status-pill-overdue flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3" /> OVERSTAY
                      </span>
                    ) : isRegistered ? (
                      <span className="status-pill status-pill-paid">RESIDENT</span>
                    ) : (
                      <span className="status-pill bg-blue-50 text-blue-700 border border-blue-200 font-bold">GUEST PASS</span>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="p-6 text-center text-xs text-slate-400">No vehicle logs recorded</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
