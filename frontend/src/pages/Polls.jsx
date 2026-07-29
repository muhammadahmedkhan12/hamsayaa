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
  AlertCircle
} from 'lucide-react';
import { fetchPolls, createPollApi, closePollApi, exportPollReportApi } from '../services/api';

export default function Polls() {
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form State
  const [pollForm, setPollForm] = useState({
    title: '',
    options: ['', ''], // Start with 2 options
    expiry_date: '',
    expiry_time: '18:00',
  });

  useEffect(() => {
    loadPollsData();
  }, []);

  const loadPollsData = async () => {
    setLoading(true);
    const data = await fetchPolls();
    setPolls(data || []);
    setLoading(false);
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
    const cleanOptions = pollForm.options.map(opt => opt.trim()).filter(Boolean);
    if (cleanOptions.length < 2 || !pollForm.title || !pollForm.expiry_date) {
      alert('Please fill out the question, select expiry, and provide at least 2 non-empty options.');
      return;
    }

    const expiryTimestamp = `${pollForm.expiry_date}T${pollForm.expiry_time}:00Z`;

    const newPollData = {
      title: pollForm.title,
      options: cleanOptions,
      expiry_timestamp: expiryTimestamp,
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
    setShowCreateModal(false);

    // Call API
    await createPollApi(newPollData);
    loadPollsData(); // Refetch to sync state cleanly

    // Reset Form
    setPollForm({
      title: '',
      options: ['', ''],
      expiry_date: '',
      expiry_time: '18:00',
    });
  };

  // Close Poll Manually
  const handleClosePoll = async (pollId) => {
    setPolls((prev) =>
      prev.map((p) => (p.id === pollId ? { ...p, is_closed: true } : p))
    );
    await closePollApi(pollId);
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

        <div className="flex items-center gap-3">
          <button
            onClick={loadPollsData}
            className="flex items-center gap-1.5 px-3 py-2 bg-white text-slate-700 font-medium text-sm rounded-lg border border-surface-border hover:bg-slate-50 transition-colors shadow-xs"
            title="Refresh active polls data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-brand-600' : ''}`} />
            <span>Reload</span>
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-brand-50 text-brand-500 border border-brand-500 font-semibold text-sm rounded-lg shadow-sm transition-colors"
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
            const options = poll.options || [];
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
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <h3 className="font-bold text-navy text-sm leading-snug">{poll.title}</h3>
                    {isClosed ? (
                      <span className="status-pill bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1 font-bold">
                        <Lock className="w-3 h-3" /> Closed
                      </span>
                    ) : (
                      <span className="status-pill bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 font-bold">
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
                      <button
                        onClick={() => handleClosePoll(poll.id)}
                        className="px-2.5 py-1 text-[10px] font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded transition-colors"
                      >
                        Close Voting
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => handleExportReport(poll.id, 'pdf')}
                          className="px-2.5 py-1 text-[10px] font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded flex items-center gap-1 shadow-xs transition-colors"
                          title="Export PDF audit file"
                        >
                          <FileText className="w-3.5 h-3.5 text-red-500" />
                          <span>PDF Report</span>
                        </button>
                        <button
                          onClick={() => handleExportReport(poll.id, 'xlsx')}
                          className="px-2.5 py-1 text-[10px] font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded flex items-center gap-1 shadow-xs transition-colors"
                          title="Export Excel audit sheet"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Excel</span>
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
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="p-5 bg-navy text-white flex items-center justify-between">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Vote className="w-5 h-5 text-brand-400" /> Create WhatsApp Society Poll
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateSubmit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Poll Question / Proposal Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Upgrade Block B elevator system?"
                  value={pollForm.title}
                  onChange={(e) => setPollForm({ ...pollForm, title: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-800 text-xs focus:outline-none"
                />
              </div>

              {/* Dynamic Options List */}
              <div className="space-y-2">
                <label className="block font-bold text-slate-700 flex items-center justify-between">
                  <span>Voting Options</span>
                  <button
                    type="button"
                    onClick={handleAddOption}
                    className="text-[10px] text-brand-600 hover:underline font-bold flex items-center gap-0.5"
                  >
                    + Add Option
                  </button>
                </label>

                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {pollForm.options.map((opt, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        required
                        placeholder={`Option ${index + 1}`}
                        value={opt}
                        onChange={(e) => handleOptionChange(index, e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-none"
                      />
                      {pollForm.options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveOption(index)}
                          className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
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
                    value={pollForm.expiry_date}
                    onChange={(e) => setPollForm({ ...pollForm, expiry_date: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Expiry Time</label>
                  <input
                    type="time"
                    required
                    value={pollForm.expiry_time}
                    onChange={(e) => setPollForm({ ...pollForm, expiry_time: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-800"
                  />
                </div>
              </div>

              {/* Help tip */}
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-[10px] text-blue-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <p>
                  Saving this poll will register it in the database and activate it for residents. They can instantly vote by sending the option text to the WhatsApp bot.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-lg shadow transition-colors"
                >
                  Create & Launch Poll
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
