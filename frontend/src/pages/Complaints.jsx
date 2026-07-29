import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  UserCheck,
  ShieldAlert,
  Bot,
  RefreshCw
} from 'lucide-react';
import { mockComplaints } from '../services/mockData';

export default function Complaints() {
  const [complaints, setComplaints] = useState(mockComplaints);
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredComplaints = complaints.filter((c) => {
    const matchesStatus = selectedStatus === 'All' || c.status === selectedStatus.toLowerCase() || c.statusLabel === selectedStatus;
    const q = searchQuery.toLowerCase();
    const matchesSearch = c.id.toLowerCase().includes(q) || c.unit.toLowerCase().includes(q) || c.description.toLowerCase().includes(q) || c.residentName.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const humanReviewCount = complaints.filter(c => c.status === 'needs_human_review' || c.statusLabel === 'Needs Human Review').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy tracking-tight">Complaints & Tickets</h1>
          <p className="text-sm text-slate-500 mt-0.5">WhatsApp AI ticket dispatch, auto-categorization, and 2-failure human review queue.</p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-xs">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>{humanReviewCount} Tickets Need Human Review</span>
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-1 overflow-x-auto">
          {['All', 'Needs Human Review', 'Open', 'In Progress', 'Resolved'].map((st) => (
            <button
              key={st}
              onClick={() => setSelectedStatus(st)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                selectedStatus === st
                  ? 'bg-navy text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 w-60 shadow-sm">
          <Search className="w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search ticket ID, unit, description..."
            className="bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none w-full"
          />
        </div>
      </div>

      {/* Complaints List */}
      <div className="bg-white rounded-lg border border-surface-border shadow-sm overflow-hidden">
        <div className="p-4 border-b border-surface-border bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-emerald-600" />
            <h2 className="font-bold text-navy text-sm">Active Resident Complaints ({filteredComplaints.length})</h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">Auto-Categorized by Gemini 1.5 Flash</span>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredComplaints.map((c) => {
            const isHumanReview = c.status === 'needs_human_review' || c.statusLabel === 'Needs Human Review';
            return (
              <div key={c.id} className="p-4 hover:bg-slate-50/80 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-navy text-xs px-2 py-0.5 bg-slate-100 rounded border border-slate-200">
                      {c.id}
                    </span>
                    <span className="font-bold text-slate-800 text-xs">Unit {c.unit} — {c.residentName}</span>
                    <span className="text-[10px] text-slate-400 font-mono">• {c.timestamp}</span>
                  </div>

                  <p className="text-xs text-slate-700 font-medium">{c.description}</p>

                  <div className="flex items-center gap-2 pt-1">
                    <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded border border-blue-200">
                      {c.category}
                    </span>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <MessageSquare className="w-3 h-3 text-emerald-600" /> Source: WhatsApp Bot
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {isHumanReview ? (
                    <span className="status-pill bg-amber-100 text-amber-800 border border-amber-300 font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-amber-600" /> Needs Human Review
                    </span>
                  ) : c.status === 'resolved' ? (
                    <span className="status-pill status-pill-paid flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Resolved
                    </span>
                  ) : (
                    <span className="status-pill status-pill-unpaid">Open</span>
                  )}

                  <button className="px-3 py-1 bg-navy text-white text-xs font-semibold rounded hover:bg-slate-800 transition-colors shadow-xs">
                    View Details
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
