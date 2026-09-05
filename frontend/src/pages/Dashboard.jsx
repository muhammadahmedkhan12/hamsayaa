import React, { useState, useEffect } from 'react';
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
  const vehicleLogs = summary?.vehicle_logs ?? [];

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
        {/* Card 1: Open Tickets (Aesthetic Minimalist Redesign) */}
        <Link
          to="/complaints"
          className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs hover:border-slate-300 hover:shadow-xs transition-all group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 group-hover:text-slate-700 transition-colors">
                Open Tickets
              </span>
              <Ticket className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
            </div>
            <div className="mt-3 flex items-baseline gap-2.5">
              <span className="text-2xl font-bold text-navy tracking-tight">{openTickets}</span>
              {humanReview > 0 ? (
                <span className="text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  {humanReview} review needed
                </span>
              ) : (
                <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-md">
                  Active
                </span>
              )}
            </div>
          </div>
          <div className="text-[11px] text-slate-400 mt-3 font-normal flex items-center justify-between border-t border-slate-100 pt-2.5">
            <span>Complaints queue</span>
            <span className="text-brand-600 font-medium group-hover:translate-x-0.5 transition-transform">
              View tickets →
            </span>
          </div>
        </Link>

        {/* Card 2: Overdue Maintenance Dues */}
        <Link
          to="/invoices"
          className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs hover:border-slate-300 hover:shadow-xs transition-all group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 group-hover:text-slate-700 transition-colors">
                Overdue Dues
              </span>
              <AlertTriangle className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
            </div>
            <div className="mt-3 flex items-baseline gap-2.5 flex-wrap">
              <span className="text-2xl font-bold text-navy tracking-tight">
                Rs. {overdueTotal.toLocaleString()}
              </span>
              {overdueCount > 0 ? (
                <span className="text-[11px] font-medium text-red-700 bg-red-50 border border-red-200/80 px-2 py-0.5 rounded-md">
                  {overdueCount} {overdueCount === 1 ? 'unit' : 'units'}
                </span>
              ) : (
                <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-md">
                  All cleared
                </span>
              )}
            </div>
          </div>
          <div className="text-[11px] text-slate-400 mt-3 font-normal flex items-center justify-between border-t border-slate-100 pt-2.5">
            <span>Payment ledger</span>
            <span className="text-brand-600 font-medium group-hover:translate-x-0.5 transition-transform">
              View invoices →
            </span>
          </div>
        </Link>

        {/* Card 3: Active Guest Passes */}
        <Link
          to="/vehicles"
          className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs hover:border-slate-300 hover:shadow-xs transition-all group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 group-hover:text-slate-700 transition-colors">
                Active Guest Passes
              </span>
              <Car className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
            </div>
            <div className="mt-3 flex items-baseline gap-2.5">
              <span className="text-2xl font-bold text-navy tracking-tight">{activePasses}</span>
              <span className="text-[11px] font-medium text-brand-700 bg-brand-50 border border-brand-200/80 px-2 py-0.5 rounded-md">
                Valid window
              </span>
            </div>
          </div>
          <div className="text-[11px] text-slate-400 mt-3 font-normal flex items-center justify-between border-t border-slate-100 pt-2.5">
            <span>Pass verification</span>
            <span className="text-brand-600 font-medium group-hover:translate-x-0.5 transition-transform">
              Gate records →
            </span>
          </div>
        </Link>

        {/* Card 4: Flagged Overstay Vehicles */}
        <Link
          to="/vehicles"
          className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs hover:border-slate-300 hover:shadow-xs transition-all group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 group-hover:text-slate-700 transition-colors">
                Flagged Overstays
              </span>
              <ShieldAlert className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
            </div>
            <div className="mt-3 flex items-baseline gap-2.5">
              <span className="text-2xl font-bold text-navy tracking-tight">{flaggedOverstays}</span>
              {flaggedOverstays > 0 ? (
                <span className="text-[11px] font-medium text-red-700 bg-red-50 border border-red-200/80 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  0-min grace
                </span>
              ) : (
                <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                  None flagged
                </span>
              )}
            </div>
          </div>
          <div className="text-[11px] text-slate-400 mt-3 font-normal flex items-center justify-between border-t border-slate-100 pt-2.5">
            <span>Security monitoring</span>
            <span className="text-brand-600 font-medium group-hover:translate-x-0.5 transition-transform">
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
