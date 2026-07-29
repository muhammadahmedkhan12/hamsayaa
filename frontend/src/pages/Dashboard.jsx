import React from 'react';
import {
  Car,
  Receipt,
  MessageSquare,
  ShieldAlert,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  FileSpreadsheet,
  Plus
} from 'lucide-react';
import {
  mockDashboardMetrics,
  mockComplaints,
  mockVehicleLogs,
  mockActivePasses
} from '../services/mockData';

export default function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Page Header with Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy tracking-tight">Overview Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Real-time operational concierge for Lakeview Apartments.</p>
        </div>

        {/* Forest Green Primary Action Buttons */}
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-3.5 py-2 bg-white text-slate-700 font-medium text-sm rounded-lg border border-surface-border hover:bg-slate-50 transition-colors shadow-sm">
            <FileSpreadsheet className="w-4 h-4 text-slate-500" />
            <span>Import Excel Roster</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm rounded-lg shadow transition-colors">
            <Plus className="w-4 h-4" />
            <span>Generate Invoices</span>
          </button>
        </div>
      </div>

      {/* Immediate Overstay Alert Banner (High-Visibility Stitch Component) */}
      <div className="bg-red-600 text-white rounded-lg p-4 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-700/80 flex items-center justify-center flex-shrink-0 ring-2 ring-white/30">
            <ShieldAlert className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <h3 className="font-bold text-sm">IMMEDIATE OVERSTAY ALERT — {mockDashboardMetrics.flaggedOverstays} Unregistered Vehicles Flagged</h3>
            <p className="text-xs text-red-100 mt-0.5">Visitor passes expired without exit log. Default 0-minute grace period enforced.</p>
          </div>
        </div>
        <button className="self-start sm:self-auto px-3.5 py-1.5 bg-white text-red-700 font-semibold text-xs rounded-md shadow hover:bg-red-50 transition-colors flex items-center gap-1">
          <span>Resolve Overstay Logs</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 4 Metric Summary Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Open Tickets */}
        <div className="metric-card border-l-4 border-l-blue-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Open Tickets</span>
            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-navy">{mockDashboardMetrics.openTickets}</span>
            <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
              {mockDashboardMetrics.ticketsHumanReview} Needs Review
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-2">Gemini auto-categorized WhatsApp tickets</p>
        </div>

        {/* Card 2: Overdue Invoices */}
        <div className="metric-card border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Overdue Dues</span>
            <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-navy">Rs. {mockDashboardMetrics.overdueAmount}</span>
            <span className="text-xs font-semibold text-red-600">{mockDashboardMetrics.overdueCount} Units</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">Manual Admin account suspension enabled</p>
        </div>

        {/* Card 3: Active Visitor Passes */}
        <div className="metric-card border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Guest Passes</span>
            <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-navy">{mockDashboardMetrics.activePasses}</span>
            <span className="text-xs font-semibold text-emerald-600">Visual Code Verification</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">30-day visitor CNIC auto-purge policy</p>
        </div>

        {/* Card 4: Flagged Overstay Vehicles */}
        <div className="metric-card border-l-4 border-l-red-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Vehicle Overstays</span>
            <div className="w-8 h-8 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
              <Car className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-navy">{mockDashboardMetrics.flaggedOverstays}</span>
            <span className="text-xs font-bold text-red-600 uppercase">Immediate Flag</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">Unregistered visitor vehicles only</p>
        </div>
      </div>

      {/* Split-View Section: Left Side Complaints | Right Side Live Gate Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT SIDE (5 Cols): Recent Complaints & Tickets */}
        <div className="lg:col-span-5 bg-white rounded-lg border border-surface-border shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-surface-border bg-slate-50/60 flex items-center justify-between">
            <h2 className="font-bold text-navy text-base flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-600" />
              Recent Complaints & Tickets
            </h2>
            <span className="text-xs text-slate-400 font-medium">Gemini 1.5 Flash</span>
          </div>

          <div className="p-4 flex-1 space-y-3.5 overflow-y-auto max-h-[460px]">
            {mockComplaints.map((ticket) => (
              <div key={ticket.id} className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-navy">{ticket.id}</span>
                    <span className="text-slate-400">•</span>
                    <span className="font-semibold text-slate-700">{ticket.unit}</span>
                  </div>
                  {ticket.status === 'needs_human_review' ? (
                    <span className="status-pill status-pill-pending">Needs Human Review</span>
                  ) : ticket.status === 'open' ? (
                    <span className="status-pill status-pill-open">Open</span>
                  ) : ticket.status === 'in_progress' ? (
                    <span className="status-pill status-pill-pending">In Progress</span>
                  ) : (
                    <span className="status-pill status-pill-paid">Resolved</span>
                  )}
                </div>

                <p className="text-xs font-semibold text-slate-800">{ticket.category}</p>
                <p className="text-xs text-slate-600 line-clamp-2">{ticket.description}</p>

                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                  <span>{ticket.residentName} ({ticket.source})</span>
                  <span>{ticket.timestamp}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT SIDE (7 Cols): Live Gate & Vehicle Entry Logs */}
        <div className="lg:col-span-7 bg-white rounded-lg border border-surface-border shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-surface-border bg-slate-50/60 flex items-center justify-between">
            <h2 className="font-bold text-navy text-base flex items-center gap-2">
              <Car className="w-4 h-4 text-emerald-600" />
              Live Gate & Vehicle Entry Logs
            </h2>
            <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200">
              0-Min Grace Period
            </span>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Vehicle Plate</th>
                  <th className="px-4 py-3">Visitor / Resident</th>
                  <th className="px-4 py-3">Entry Time</th>
                  <th className="px-4 py-3">Pass Expiry</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mockVehicleLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-navy text-sm">{log.vehiclePlate}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800">{log.visitorName}</p>
                      <p className="text-[10px] text-slate-400">{log.residentUnit} ({log.source})</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{log.entryTime}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {log.isFlaggedOverstay ? (
                        <span className="text-red-600 font-bold">{log.passExpiry}</span>
                      ) : (
                        <span>{log.passExpiry}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {log.isFlaggedOverstay ? (
                        <span className="status-pill status-pill-overdue">OVERSTAY</span>
                      ) : log.isRegistered ? (
                        <span className="status-pill status-pill-paid">REGISTERED</span>
                      ) : (
                        <span className="status-pill status-pill-pending">ACTIVE PASS</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
