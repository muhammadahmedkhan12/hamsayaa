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
            <div key={i} className="metric-card border-l-4 border-l-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-8 w-8 rounded-lg" />
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
          className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-xs rounded-lg shadow-xs transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-brand-600' : ''}`} />
          <span>Refresh Live Data</span>
        </button>
      </div>

      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Open Tickets */}
        <div className="metric-card border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Open Tickets</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Ticket className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-bold text-navy">{openTickets}</span>
            {humanReview > 0 && (
              <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-300 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-600" /> {humanReview} Needs Review
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-2 font-medium">WhatsApp AI Concierge Queue</p>
        </div>

        {/* Card 2: Overdue Maintenance Dues */}
        <Link to="/invoices" className="metric-card border-l-4 border-l-red-500 hover:shadow-md transition-shadow cursor-pointer block">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Overdue Dues</span>
            <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-navy">Rs. {overdueTotal.toLocaleString()}</span>
            <span className="text-xs font-bold text-red-600 font-mono">{overdueCount} Units</span>
          </div>
          <p className="text-xs text-slate-500 mt-2 font-medium flex items-center justify-between">
            <span>Manual Block Control</span>
            <span className="text-brand-600 font-semibold hover:underline">View Invoices →</span>
          </p>
        </Link>

        {/* Card 3: Active Guest Passes */}
        <div className="metric-card border-l-4 border-l-brand-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Guest Passes</span>
            <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
              <Car className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-bold text-navy">{activePasses}</span>
            <span className="text-xs font-bold text-brand-600 font-mono">Valid Window</span>
          </div>
          <p className="text-xs text-slate-500 mt-2 font-medium">Visual Pass Code Verification</p>
        </div>

        {/* Card 4: Flagged Overstay Vehicles */}
        <div className="metric-card border-l-4 border-l-navy">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Flagged Overstays</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-navy flex items-center justify-center">
              <ShieldAlert className="w-4 h-4 text-red-600" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-bold text-navy">{flaggedOverstays}</span>
            <span className="bg-red-50 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded border border-red-200">
              0-Min Grace
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2 font-medium">Unregistered Visitor Vehicles</p>
        </div>
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

                    <p className="text-xs text-slate-600 line-clamp-2">{c.description}</p>
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
