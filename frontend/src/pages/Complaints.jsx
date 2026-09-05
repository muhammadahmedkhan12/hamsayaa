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
import { fetchComplaints, updateComplaintStatus } from '../services/api';

export default function Complaints() {
  const [complaints, setComplaints] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [resolvingId, setResolvingId] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadComplaints = async () => {
    setLoading(true);
    const data = await fetchComplaints();
    setComplaints(data);
    setLoading(false);
  };

  useEffect(() => {
    loadComplaints();
  }, []);

  const handleResolve = async (complaint) => {
    const id = complaint.id;
    setResolvingId(id);
    const result = await updateComplaintStatus(id, 'resolved');
    if (result) {
      setComplaints((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: 'resolved' } : c))
      );
    }
    setResolvingId(null);
  };

  const filteredComplaints = complaints.filter((c) => {
    const status = c.status || '';
    const statusLabel = c.statusLabel || '';
    const matchesStatus =
      selectedStatus === 'All' ||
      status === selectedStatus.toLowerCase().replace(/ /g, '_') ||
      statusLabel === selectedStatus;
    const q = searchQuery.toLowerCase();
    const ticketId = c.ticket_number || c.id || '';
    const unit = c.unit_number || c.unit || '';
    const resName = c.residents?.name || c.residentName || '';
    const desc = (c.description || '').replace(/\[Audio:\s*https?:\/\/[^\]]+\]/gi, '').trim();
    const matchesSearch =
      ticketId.toLowerCase().includes(q) ||
      unit.toLowerCase().includes(q) ||
      desc.toLowerCase().includes(q) ||
      resName.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const humanReviewCount = complaints.filter(
    (c) => c.status === 'needs_human_review' || c.statusLabel === 'Needs Human Review'
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy tracking-tight">Complaints & Tickets</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            WhatsApp AI ticket dispatch, auto-categorization, and 2-failure human review queue.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadComplaints}
            className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
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
            <Bot className="w-4 h-4 text-brand-500" />
            <h2 className="font-bold text-navy text-sm">Active Resident Complaints ({filteredComplaints.length})</h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">Auto-Categorized by Gemini AI</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading complaints...</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredComplaints.map((c) => {
              const status = c.status || '';
              const isHumanReview = status === 'needs_human_review' || c.statusLabel === 'Needs Human Review';
              const isResolved = status === 'resolved';
              const isOpen = status === 'open' || status === 'in_progress';
              const ticketId = c.ticket_number || c.id || 'N/A';
              const unit = c.unit_number || c.unit || '';
              const resName = c.residents?.name || c.residentName || 'Unknown';
              const building = c.residents?.building || '';
              const desc = (c.description || '').replace(/\[Audio:\s*https?:\/\/[^\]]+\]/gi, '').trim();
              const category = c.category || '';
              const timestamp = c.created_at
                ? new Date(c.created_at).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                : c.timestamp || '';

              return (
                <div key={c.id} className="p-4 hover:bg-slate-50/80 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-navy text-xs px-2 py-0.5 bg-slate-100 rounded border border-slate-200">
                        {ticketId}
                      </span>
                      <span className="font-bold text-slate-800 text-xs">
                        {building ? `${building} - ` : ''}Unit {unit} — {resName}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">• {timestamp}</span>
                    </div>

                    <p className="text-xs text-slate-700 font-medium">{desc}</p>

                    <div className="flex items-center gap-2 pt-1">
                      <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded border border-blue-200">
                        {category}
                      </span>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <MessageSquare className="w-3 h-3 text-brand-500" /> Source: WhatsApp Bot
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {isHumanReview ? (
                      <span className="status-pill bg-amber-100 text-amber-800 border border-amber-300 font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-amber-600" /> Needs Human Review
                      </span>
                    ) : isResolved ? (
                      <span className="status-pill status-pill-paid flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Resolved
                      </span>
                    ) : (
                      <span className="status-pill status-pill-unpaid">Open</span>
                    )}

                    {!isResolved && (
                      <button
                        onClick={() => handleResolve(c)}
                        disabled={resolvingId === c.id}
                        className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors shadow-xs flex items-center gap-1.5 ${
                          resolvingId === c.id
                            ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                            : 'bg-emerald-600 text-white hover:bg-emerald-700'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {resolvingId === c.id ? 'Resolving...' : 'Mark Resolved'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
