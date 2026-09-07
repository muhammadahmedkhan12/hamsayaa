import React, { useState, useEffect } from 'react';
import {
  Vote,
  Plus,
  X,
  FileText,
  FileSpreadsheet,
  Clock,
  CheckCircle2,
  Lock,
  RefreshCw,
  AlertCircle,
  Send,
  MessageSquare,
  Building2,
  Users,
  Check,
  Trash2
} from 'lucide-react';
import {
  fetchPolls,
  createPollApi,
  closePollApi,
  deletePollApi,
  exportPollReportApi,
  broadcastPollApi,
  fetchResidents
} from '../services/api';

export default function Polls() {
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Broadcast Active Poll Modal State
  const [showBroadcastModal, setShowBroadcastModal] = useState(null);
  const [broadcastScope, setBroadcastScope] = useState('All');
  const [broadcastLoading, setBroadcastLoading] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState(null);

  // Delete Poll Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Available Buildings for Scope
  const [buildings, setBuildings] = useState(['Block A', 'Block B', 'Block C']);
  const [showPreview, setShowPreview] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [createBroadcastResult, setCreateBroadcastResult] = useState(null);

  const getTodayDateString = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const getTomorrowDateString = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const formatExpiryDisplay = (isoTimestamp) => {
    if (!isoTimestamp) return '';
    try {
      const d = new Date(isoTimestamp);
      return d.toLocaleDateString('en-PK', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoTimestamp;
    }
  };

  // Form State
  const [pollForm, setPollForm] = useState({
    title: '',
    options: ['', ''], // Start with 2 options
    expiry_date: getTomorrowDateString(),
    expiry_time: '18:00',
    send_whatsapp: true,
    building: 'All',
  });

  useEffect(() => {
    loadPollsData();
    loadBuildings();
  }, []);

  const loadPollsData = async () => {
    setLoading(true);
    const data = await fetchPolls();
    setPolls(data || []);
    setLoading(false);
  };

  const loadBuildings = async () => {
    try {
      const res = await fetchResidents();
      if (res && Array.isArray(res) && res.length > 0) {
        const unique = Array.from(new Set(res.map((r) => r.building).filter(Boolean)));
        if (unique.length > 0) setBuildings(unique);
      }
    } catch (e) {
      console.warn('Failed to load buildings for polls scope:', e);
    }
  };

  // Add a dynamic option input field
  const handleAddOption = () => {
    setPollForm({
      ...pollForm,
      options: [...pollForm.options, ''],
    });
  };

  // Remove a dynamic option input field
  const handleRemoveOption = (index) => {
    if (pollForm.options.length <= 2) return; // Keep at least 2 options
    const updated = [...pollForm.options];
    updated.splice(index, 1);
    setPollForm({ ...pollForm, options: updated });
  };

  // Handle option value changes
  const handleOptionChange = (index, value) => {
    const updated = [...pollForm.options];
    updated[index] = value;
    setPollForm({ ...pollForm, options: updated });
  };

  // Create Poll Submit
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    const cleanOptions = pollForm.options.map((opt) => opt.trim()).filter(Boolean);
    if (cleanOptions.length < 2 || !pollForm.title.trim() || !pollForm.expiry_date) {
      alert('Please fill out the question, select expiry, and provide at least 2 non-empty options.');
      return;
    }

    setSubmitting(true);
    setCreateBroadcastResult(null);

    const localDate = new Date(`${pollForm.expiry_date}T${pollForm.expiry_time}:00`);
    if (isNaN(localDate.getTime()) || localDate.getTime() <= Date.now()) {
      alert('Please select an expiry date and time in the future.');
      setSubmitting(false);
      return;
    }
    const expiryTimestamp = localDate.toISOString();

    const newPollData = {
      title: pollForm.title.trim(),
      options: cleanOptions,
      expiry_timestamp: expiryTimestamp,
      send_whatsapp: pollForm.send_whatsapp,
      building: pollForm.building === 'All' ? null : pollForm.building,
    };

    // Optimistic UI update
    const optimisticPoll = {
      id: `p-${Date.now()}`,
      ...newPollData,
      is_closed: false,
      created_at: new Date().toISOString(),
      votes: cleanOptions.reduce((acc, curr) => ({ ...acc, [curr]: 0 }), {}),
      total_votes: 0,
    };

    setPolls((prev) => [optimisticPoll, ...prev]);

    // Call API
    const res = await createPollApi(newPollData);
    setSubmitting(false);

    if (res && res.broadcast && res.broadcast.sent_count > 0) {
      setCreateBroadcastResult(res.broadcast);
      setTimeout(() => {
        setShowCreateModal(false);
        setCreateBroadcastResult(null);
        loadPollsData();
      }, 2000);
    } else {
      setShowCreateModal(false);
      loadPollsData(); // Refetch to sync state cleanly
    }

    // Reset Form
    setPollForm({
      title: '',
      options: ['', ''],
      expiry_date: getTomorrowDateString(),
      expiry_time: '18:00',
      send_whatsapp: true,
      building: 'All',
    });
  };

  // Broadcast Active Poll via WhatsApp
  const handleBroadcastPoll = async (e) => {
    if (e) e.preventDefault();
    if (!showBroadcastModal) return;

    setBroadcastLoading(true);
    setBroadcastResult(null);

    const payload = {
      building: broadcastScope === 'All' ? null : broadcastScope,
    };

    const res = await broadcastPollApi(showBroadcastModal.id, payload);
    setBroadcastLoading(false);
    setBroadcastResult(res);

    if (res && res.status === 'success') {
      setTimeout(() => {
        setShowBroadcastModal(null);
        setBroadcastResult(null);
      }, 2400);
    }
  };

  // Close Poll Manually
  const handleClosePoll = async (pollId) => {
    setPolls((prev) =>
      prev.map((p) => (p.id === pollId ? { ...p, is_closed: true } : p))
    );
    await closePollApi(pollId);
    loadPollsData();
  };

  // Delete Poll
  const handleDeletePoll = async () => {
    if (!showDeleteModal) return;
    setDeleteLoading(true);
    const targetId = showDeleteModal.id;
    setPolls((prev) => prev.filter((p) => p.id !== targetId));
    await deletePollApi(targetId);
    setDeleteLoading(false);
    setShowDeleteModal(null);
    loadPollsData();
  };

  // Export Report Call
  const handleExportReport = async (pollId, format) => {
    const res = await exportPollReportApi(pollId, format);
    if (res && res.download_url) {
      alert(`Report generated! Click OK to download your ${format.toUpperCase()} report.`);
      window.open(res.download_url, '_blank');
    } else {
      alert('Failed to generate report.');
    }
  };

  // Calculate percentages helper
  const getOptionPercentage = (votesCount, totalVotes) => {
    if (!totalVotes) return 0;
    return Math.round((votesCount / totalVotes) * 100);
  };

  // Time remaining helper
  const getTimeRemaining = (expiryStr) => {
    const expiry = new Date(expiryStr);
    const now = new Date();
    const diff = expiry - now;

    if (diff <= 0) return 'Expired';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d remaining`;
    if (hours > 0) return `${hours}h remaining`;

    const minutes = Math.floor(diff / (1000 * 60));
    return `${minutes}m remaining`;
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy tracking-tight">Polls & Digital Voting</h1>
          <p className="text-sm text-slate-500 mt-0.5">Create society digital polls and auto-export PDF/Excel voting audits upon expiry.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadPollsData}
            className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-medium text-xs rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
            title="Refresh active polls data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-brand-600' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3.5 py-2 bg-brand-500 hover:bg-brand-600 text-white font-semibold text-xs rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Poll</span>
          </button>
        </div>
      </div>

      {loading && polls.length === 0 ? (
        // Shimmer loading
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white border border-surface-border rounded-xl p-5 shadow-sm animate-pulse space-y-4">
              <div className="flex justify-between items-start">
                <div className="h-5 w-2/3 bg-slate-200 rounded"></div>
                <div className="h-5 w-16 bg-slate-200 rounded-full"></div>
              </div>
              <div className="space-y-2.5">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="space-y-1">
                    <div className="h-3 w-1/4 bg-slate-200 rounded"></div>
                    <div className="h-6 w-full bg-slate-100 rounded"></div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : polls.length === 0 ? (
        <div className="bg-white rounded-lg border border-surface-border p-8 text-center max-w-md mx-auto space-y-3">
          <Vote className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="font-bold text-navy text-sm">No Active Society Polls</h3>
          <p className="text-xs text-slate-500">Create digital voting blocks to poll society residents via WhatsApp concierge messages.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white font-semibold text-xs rounded-lg shadow"
          >
            Create First Poll
          </button>
        </div>
      ) : (
        /* Poll Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {polls.map((poll) => {
            const timeRemaining = getTimeRemaining(poll.expiry_timestamp);
            const isClosed = poll.is_closed || timeRemaining === 'Expired';
            const rawOptions = poll.options;
            const options = Array.isArray(rawOptions)
              ? rawOptions
              : (rawOptions && typeof rawOptions === 'object')
                ? Object.values(rawOptions)
                : [];
            const voteData = poll.votes || {};

            return (
              <div
                key={poll.id}
                className={`bg-white border rounded-xl p-5 shadow-sm flex flex-col justify-between transition-all ${
                  isClosed ? 'border-slate-200 bg-slate-50/40' : 'border-slate-200 hover:shadow-md'
                }`}
              >
                <div>
                  {/* Title & Status Badge */}
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <h3 className="font-bold text-navy text-sm leading-snug">{poll.title}</h3>
                      <div className="text-[11px] text-slate-500 font-medium mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>Deadline: {formatExpiryDisplay(poll.expiry_timestamp)}</span>
                      </div>
                    </div>
                    {isClosed ? (
                      <span className="status-pill bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1 font-bold shrink-0">
                        <Lock className="w-3 h-3" /> Closed
                      </span>
                    ) : (
                      <span className="status-pill bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 font-bold shrink-0">
                        <Clock className="w-3 h-3 text-emerald-600" /> {timeRemaining}
                      </span>
                    )}
                  </div>

                  {/* Option Progress Bars */}
                  <div className="space-y-3 mb-6">
                    {options.map((opt) => {
                      const count = voteData[opt] || 0;
                      const percent = getOptionPercentage(count, poll.total_votes);

                      return (
                        <div key={opt} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-slate-700">{opt}</span>
                            <span className="font-mono text-slate-500 font-bold">{count} votes ({percent}%)</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full transition-all duration-500 ${
                                isClosed ? 'bg-slate-400' : 'bg-brand-500'
                              }`}
                              style={{ width: `${percent}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between mt-auto">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                    <CheckCircle2 className={`w-4 h-4 ${isClosed ? 'text-slate-400' : 'text-brand-500'}`} />
                    <span>Total cast: <strong className="text-navy">{poll.total_votes}</strong></span>
                  </div>

                  <div className="flex items-center gap-2">
                    {!isClosed ? (
                      <>
                        <button
                          onClick={() => {
                            setShowBroadcastModal(poll);
                            setBroadcastScope('All');
                            setBroadcastResult(null);
                          }}
                          className="px-2.5 py-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
                          title="Broadcast this poll to verified residents on WhatsApp"
                        >
                          <Send className="w-3 h-3 text-emerald-600" />
                          <span>Broadcast Poll</span>
                        </button>
                        <button
                          onClick={() => handleClosePoll(poll.id)}
                          className="px-2.5 py-1 text-[10px] font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded transition-colors cursor-pointer"
                        >
                          Close Voting
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleExportReport(poll.id, 'pdf')}
                          className="px-2.5 py-1 text-[10px] font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                          title="Export PDF audit file"
                        >
                          <FileText className="w-3.5 h-3.5 text-red-500" />
                          <span>PDF</span>
                        </button>
                        <button
                          onClick={() => handleExportReport(poll.id, 'xlsx')}
                          className="px-2.5 py-1 text-[10px] font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                          title="Export Excel audit sheet"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Excel</span>
                        </button>
                        <button
                          onClick={() => setShowDeleteModal(poll)}
                          className="px-2.5 py-1 text-[10px] font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                          title="Delete this closed poll"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                          <span>Delete</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE NEW POLL MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden my-auto border border-slate-200">
            {/* Modal Header (Pinned) */}
            <div className="p-4 sm:p-5 bg-navy text-white flex items-center justify-between shrink-0">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Vote className="w-5 h-5 text-brand-400" /> Create WhatsApp Society Poll
              </h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setCreateBroadcastResult(null);
                }}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Body (Scrollable) */}
            <form onSubmit={handleCreateSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
                {createBroadcastResult && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Poll Broadcast Successfully!</p>
                      <p className="text-[11px] mt-0.5">{createBroadcastResult.message}</p>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Poll Question / Proposal Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Upgrade Block B elevator system?"
                    value={pollForm.title}
                    onChange={(e) => setPollForm({ ...pollForm, title: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-800 text-xs focus:outline-none focus:border-brand-500"
                  />
                </div>

                {/* Dynamic Options List */}
                <div className="space-y-2">
                  <label className="block font-bold text-slate-700 flex items-center justify-between">
                    <span>Voting Options (Min. 2)</span>
                    <button
                      type="button"
                      onClick={handleAddOption}
                      className="text-[10px] text-brand-600 hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                    >
                      + Add Option
                    </button>
                  </label>

                  <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                    {pollForm.options.map((opt, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <span className="w-5 text-center text-slate-400 font-bold font-mono text-[11px]">
                          {index + 1}.
                        </span>
                        <input
                          type="text"
                          required
                          placeholder={`Option ${index + 1}`}
                          value={opt}
                          onChange={(e) => handleOptionChange(index, e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-800 text-xs focus:outline-none focus:border-brand-500"
                        />
                        {pollForm.options.length > 2 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveOption(index)}
                            className="p-1.5 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                            title="Remove option"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Expiry Selector */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Expiry Date</label>
                    <input
                      type="date"
                      required
                      min={getTodayDateString()}
                      value={pollForm.expiry_date}
                      onChange={(e) => setPollForm({ ...pollForm, expiry_date: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-800 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Expiry Time</label>
                    <input
                      type="time"
                      required
                      value={pollForm.expiry_time}
                      onChange={(e) => setPollForm({ ...pollForm, expiry_time: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-800 text-xs"
                    />
                  </div>
                </div>

                {/* Target Audience Selector */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-brand-600" />
                    <span>Target Audience (Scope)</span>
                  </label>
                  <select
                    value={pollForm.building}
                    onChange={(e) => setPollForm({ ...pollForm, building: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-800 text-xs font-medium focus:outline-none focus:border-brand-500"
                  >
                    <option value="All">Whole Society (All Blocks)</option>
                    {buildings.map((b) => (
                      <option key={b} value={b}>
                        {b} only
                      </option>
                    ))}
                  </select>
                </div>

                {/* WhatsApp Broadcast Toggle Box */}
                <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl space-y-1.5">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-emerald-900 text-xs">
                    <input
                      type="checkbox"
                      checked={pollForm.send_whatsapp}
                      onChange={(e) => setPollForm({ ...pollForm, send_whatsapp: e.target.checked })}
                      className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500 cursor-pointer"
                    />
                    <span>Broadcast to Residents on WhatsApp</span>
                  </label>
                  <p className="text-[11px] text-emerald-700 pl-6 leading-relaxed">
                    Dispatches an official interactive poll notice directly to verified residents on WhatsApp (strictly 1 message per apartment). Residents vote simply by replying with their choice.
                  </p>
                </div>

                {/* WhatsApp Interactive Live Preview Bubble */}
                {pollForm.send_whatsapp && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700 flex items-center gap-1">
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                        <span>WhatsApp Mobile Chat Preview</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowPreview((prev) => !prev)}
                        className="text-[10px] font-semibold text-brand-600 hover:text-brand-700 underline cursor-pointer"
                      >
                        {showPreview ? 'Hide Preview' : 'Show Preview'}
                      </button>
                    </div>

                    {showPreview && (
                      <div className="bg-[#efeae2] p-3.5 rounded-xl border border-slate-200/80 shadow-inner">
                        <div className="bg-[#d9fdd3] text-slate-800 p-3.5 rounded-xl rounded-tl-none max-w-md shadow-xs text-xs space-y-2 border border-[#c3f4bc]">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5 text-[11px]">
                            <span>🗳️</span>
                            <span>COMMUNITY POLL: {pollForm.title.trim().toUpperCase() || 'PROPOSAL TITLE'}</span>
                          </div>

                          <p className="text-[11px] text-slate-700">
                            Dear Resident <strong>Muhammad Ahmed</strong> ({pollForm.building === 'All' ? 'Block A' : pollForm.building} - Unit 101),
                          </p>
                          <p className="text-[11px] text-slate-700">
                            Management has opened an official community poll:
                          </p>

                          <div className="text-[11px] text-slate-900 font-semibold bg-white/70 p-2 rounded border border-emerald-100 italic">
                            ❓ {pollForm.title.trim() || 'Poll question will appear here...'}
                          </div>

                          <div className="space-y-1 text-[11px] text-slate-800 font-medium">
                            <p className="font-bold text-slate-900">📋 Options:</p>
                            {pollForm.options.map((opt, i) => {
                              const numEmoji = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣'][i] || `${i + 1}.`;
                              return (
                                <p key={i} className="pl-1.5">
                                  {numEmoji} {opt.trim() || `Option ${i + 1}`}
                                </p>
                              );
                            })}
                          </div>

                          <p className="text-[10px] text-slate-600 font-mono">
                            ⏳ <strong>Voting Deadline:</strong> {pollForm.expiry_date ? `${pollForm.expiry_date} at ${pollForm.expiry_time} (PKT)` : 'Select expiry date'}
                          </p>

                          <div className="text-[10px] text-emerald-950 bg-emerald-100/70 p-2 rounded leading-snug">
                            👉 <strong>How to Vote:</strong> Reply directly to this WhatsApp message with your choice (e.g. reply <em>"1"</em> or <em>"{pollForm.options[0]?.trim() || 'Option 1'}"</em>).<br />
                            <span className="text-[9px] italic text-emerald-800">Strict 1 vote per apartment applies.</span>
                          </div>

                          <div className="pt-1.5 border-t border-emerald-200/60 text-[9px] text-slate-500 italic flex items-center justify-between">
                            <span>Official Community Poll • Hamsayaa</span>
                            <span className="text-[9px] not-italic text-slate-400 font-mono flex items-center gap-1">
                              12:30 PM <span className="text-brand-600 font-bold">✓✓</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Actions (Pinned Footer) */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
                <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${pollForm.send_whatsapp ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                  <span>
                    Scope: <strong className="text-navy">{pollForm.building === 'All' ? 'Whole Society' : pollForm.building}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setCreateBroadcastResult(null);
                    }}
                    className="px-4 py-2 bg-white text-slate-700 font-medium rounded-lg hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-semibold rounded-lg shadow transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    {submitting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Creating & Broadcasting...</span>
                      </>
                    ) : (
                      <>
                        <Vote className="w-4 h-4" />
                        <span>Create & Launch Poll</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BROADCAST ACTIVE POLL MODAL */}
      {showBroadcastModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            {/* Header */}
            <div className="p-4 bg-navy text-white flex items-center justify-between">
              <h3 className="font-bold text-sm sm:text-base flex items-center gap-2">
                <Send className="w-4 h-4 text-emerald-400" /> Broadcast Poll on WhatsApp
              </h3>
              <button
                onClick={() => {
                  setShowBroadcastModal(null);
                  setBroadcastResult(null);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4 text-xs">
              {broadcastResult && (
                <div
                  className={`p-3 rounded-lg border text-xs flex items-start gap-2 ${
                    broadcastResult.status === 'error'
                      ? 'bg-red-50 border-red-200 text-red-800'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  }`}
                >
                  {broadcastResult.status === 'error' ? (
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="font-bold">
                      {broadcastResult.status === 'error' ? 'Broadcast Delivery Error' : 'Poll Dispatched Successfully!'}
                    </p>
                    <p className="text-[11px] mt-0.5">{broadcastResult.message}</p>
                    {broadcastResult.sent_count !== undefined && (
                      <p className="text-[11px] font-mono mt-1 font-bold">
                        Sent: {broadcastResult.sent_count} / {broadcastResult.targets_count} apartments
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">Poll Question</label>
                <p className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-navy font-semibold">
                  {showBroadcastModal.title}
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-brand-600" />
                  <span>Target Scope</span>
                </label>
                <select
                  value={broadcastScope}
                  onChange={(e) => setBroadcastScope(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-800 text-xs font-medium focus:outline-none focus:border-brand-500"
                >
                  <option value="All">Whole Society (All Blocks)</option>
                  {buildings.map((b) => (
                    <option key={b} value={b}>
                      {b} only
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-[11px] text-blue-800 space-y-1">
                <p className="font-semibold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5 text-blue-600" />
                  <span>1-Message-per-Apartment Policy Enforced</span>
                </p>
                <p className="text-slate-600 text-[10px] leading-relaxed">
                  Only one message is dispatched per unique apartment unit, prioritizing the verified owner or active tenant as primary contact to prevent household alert spam.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowBroadcastModal(null);
                  setBroadcastResult(null);
                }}
                className="px-3.5 py-2 bg-white text-slate-700 font-medium rounded-lg hover:bg-slate-100 border border-slate-200 text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={broadcastLoading}
                onClick={handleBroadcastPoll}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold rounded-lg shadow text-xs flex items-center gap-1.5 cursor-pointer"
              >
                {broadcastLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Broadcasting...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Broadcast Now</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CLOSED POLL CONFIRMATION MODAL */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden my-auto border border-slate-200">
            {/* Header */}
            <div className="p-4 sm:p-5 bg-red-600 text-white flex items-center justify-between shrink-0">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-red-200" /> Delete Closed Poll
              </h3>
              <button
                type="button"
                onClick={() => setShowDeleteModal(null)}
                className="text-red-200 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-3.5 flex-1 overflow-y-auto text-xs">
              <p className="text-slate-700 leading-relaxed font-medium">
                Are you sure you want to permanently delete this closed poll?
              </p>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <p className="font-bold text-xs text-navy leading-snug">{showDeleteModal.title}</p>
                <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-2">
                  <span>Total votes: <strong className="text-navy">{showDeleteModal.total_votes || 0}</strong></span>
                  <span>•</span>
                  <span>Status: <strong className="text-slate-700">Closed</strong></span>
                </div>
              </div>
              <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-red-700 text-[11px] flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <p>
                  This action cannot be undone. All cast votes and audit records for this poll will be permanently deleted from the database.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowDeleteModal(null)}
                disabled={deleteLoading}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeletePoll}
                disabled={deleteLoading}
                className="px-4 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {deleteLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Poll</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
