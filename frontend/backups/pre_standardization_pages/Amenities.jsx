import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Waves,
  Dumbbell,
  PartyPopper,
  Clock,
  Users,
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  X,
  CheckCircle2,
  Calendar,
  AlertCircle,
  ShieldCheck,
  Bot,
  Building,
  Trees,
  Trophy
} from 'lucide-react';
import {
  fetchAmenities,
  createAmenityApi,
  updateAmenityApi,
  deleteAmenityApi
} from '../services/api';

const PRESET_CATEGORIES = [
  'Sports & Fitness',
  'Leisure & Swimming Pool',
  'Events & Banquet Hall',
  'Prayer & Religious Space',
  'Parks & Green Areas',
  'General Facility'
];

export default function Amenities() {
  const [amenities, setAmenities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('All');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAmenity, setEditingAmenity] = useState(null);
  const [deletingAmenity, setDeletingAmenity] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    timings: '06:00 - 22:00 Daily',
    rules: '',
    capacity: 30,
    is_bookable: false
  });

  const [submitting, setSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');

  useEffect(() => {
    loadAmenities();
  }, []);

  const loadAmenities = async () => {
    setLoading(true);
    const data = await fetchAmenities();
    setAmenities(data || []);
    setLoading(false);
  };

  // Helper for Category Icons
  const getAmenityIcon = (name = '') => {
    const n = name.toLowerCase();
    if (n.includes('pool') || n.includes('swim')) return <Waves className="w-5 h-5 text-cyan-600" />;
    if (n.includes('gym') || n.includes('fit')) return <Dumbbell className="w-5 h-5 text-amber-600" />;
    if (n.includes('hall') || n.includes('event') || n.includes('banquet')) return <PartyPopper className="w-5 h-5 text-purple-600" />;
    if (n.includes('mosque') || n.includes('prayer') || n.includes('masjid')) return <Sparkles className="w-5 h-5 text-emerald-600" />;
    if (n.includes('park') || n.includes('play') || n.includes('garden')) return <Trees className="w-5 h-5 text-green-600" />;
    if (n.includes('court') || n.includes('badminton') || n.includes('tennis')) return <Trophy className="w-5 h-5 text-indigo-600" />;
    return <Building className="w-5 h-5 text-slate-600" />;
  };

  // Metrics
  const totalCount = amenities.length;
  const bookableCount = amenities.filter(a => a.is_bookable).length;
  const openAccessCount = amenities.filter(a => !a.is_bookable).length;
  const totalCapacity = amenities.reduce((acc, a) => acc + (a.capacity || 0), 0);

  // Filtered Amenities
  const filteredAmenities = amenities.filter((am) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      (am.name || '').toLowerCase().includes(q) ||
      (am.description || '').toLowerCase().includes(q) ||
      (am.rules || '').toLowerCase().includes(q) ||
      (am.timings || '').toLowerCase().includes(q);

    let matchesCategory = true;
    const n = (am.name || '').toLowerCase();
    if (selectedFilter === 'Sports') matchesCategory = n.includes('gym') || n.includes('court') || n.includes('badminton');
    else if (selectedFilter === 'Pool') matchesCategory = n.includes('pool') || n.includes('swim');
    else if (selectedFilter === 'Events') matchesCategory = n.includes('hall') || n.includes('event') || am.is_bookable;
    else if (selectedFilter === 'Community') matchesCategory = n.includes('mosque') || n.includes('prayer') || n.includes('park');

    return matchesSearch && matchesCategory;
  });

  // Handle Create Amenity
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) return;
    setSubmitting(true);

    const payload = {
      name: formData.name.trim(),
      description: formData.description.trim() || null,
      timings: formData.timings.trim() || '06:00 - 22:00 Daily',
      rules: formData.rules.trim() || null,
      capacity: parseInt(formData.capacity) || 30,
      is_bookable: Boolean(formData.is_bookable)
    };

    const res = await createAmenityApi(payload);
    if (res && res.amenity) {
      setAmenities((prev) => [res.amenity, ...prev]);
      setShowAddModal(false);
      setFormData({
        name: '',
        description: '',
        timings: '06:00 - 22:00 Daily',
        rules: '',
        capacity: 30,
        is_bookable: false
      });
      setFeedbackMsg(`Facility "${payload.name}" added successfully!`);
      setTimeout(() => setFeedbackMsg(''), 4000);
    }
    setSubmitting(false);
  };

  // Handle Edit Amenity
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingAmenity) return;
    setSubmitting(true);

    const payload = {
      name: editingAmenity.name.trim(),
      description: editingAmenity.description?.trim() || null,
      timings: editingAmenity.timings?.trim() || '06:00 - 22:00 Daily',
      rules: editingAmenity.rules?.trim() || null,
      capacity: parseInt(editingAmenity.capacity) || 30,
      is_bookable: Boolean(editingAmenity.is_bookable)
    };

    const res = await updateAmenityApi(editingAmenity.id, payload);
    if (res && res.amenity) {
      setAmenities((prev) =>
        prev.map((a) => (a.id === editingAmenity.id ? { ...a, ...res.amenity } : a))
      );
      setEditingAmenity(null);
      setFeedbackMsg(`Facility "${payload.name}" updated successfully!`);
      setTimeout(() => setFeedbackMsg(''), 4000);
    }
    setSubmitting(false);
  };

  // Handle Delete Amenity
  const handleDeleteConfirm = async () => {
    if (!deletingAmenity) return;
    const amId = deletingAmenity.id;
    await deleteAmenityApi(amId);
    setAmenities((prev) => prev.filter((a) => a.id !== amId));
    setDeletingAmenity(null);
    setFeedbackMsg('Facility record removed.');
    setTimeout(() => setFeedbackMsg(''), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Toast Feedback Notification */}
      {feedbackMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-lg flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{feedbackMsg}</span>
          </div>
          <button onClick={() => setFeedbackMsg('')} className="text-emerald-600 hover:text-emerald-900">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy tracking-tight flex items-center gap-2.5">
            <Sparkles className="w-6 h-6 text-brand-500" />
            Amenities & Facilities Info
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Configure community facility timings, rules, capacities, and reservation policies.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadAmenities}
            className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-1.5 bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Add Facility
          </button>
        </div>
      </div>

      {/* Dynamic WhatsApp AI Concierge Integration Banner */}
      <div className="bg-gradient-to-r from-slate-50 to-emerald-50/50 border border-slate-200 rounded-lg p-3.5 flex items-start gap-3 shadow-xs">
        <Bot className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-600 space-y-0.5">
          <p className="font-bold text-navy flex items-center gap-2">
            Dynamic WhatsApp AI Concierge Integration
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
              Live Synchronized
            </span>
          </p>
          <p>
            Any schedules, ladies-only hours, or rules updated in this tab are <span className="font-semibold text-slate-800">instantly injected into Gemini's context</span>.
            When residents ask on WhatsApp (e.g. <i>"What are the gym hours?"</i> or <i>"Can I book the event hall for Saturday?"</i>), the AI answers dynamically using these records without needing any code changes.
          </p>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-surface-border shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-navy shrink-0">
            <Sparkles className="w-5 h-5 text-slate-700" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Total Facilities</div>
            <div className="text-xl font-bold text-navy">{totalCount}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-surface-border shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
            <PartyPopper className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Bookable Venues</div>
            <div className="text-xl font-bold text-purple-700">{bookableCount}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-surface-border shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Open Drop-In Access</div>
            <div className="text-xl font-bold text-emerald-700">{openAccessCount}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-surface-border shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Total Combined Capacity</div>
            <div className="text-xl font-bold text-blue-700">{totalCapacity} people</div>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-1 overflow-x-auto">
          {[
            { id: 'All', label: 'All Facilities' },
            { id: 'Sports', label: 'Sports & Fitness' },
            { id: 'Pool', label: 'Swimming Pool' },
            { id: 'Events', label: 'Event & Banquet Halls' },
            { id: 'Community', label: 'Mosque & Parks' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                selectedFilter === tab.id
                  ? 'bg-navy text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 w-64 shadow-xs">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search facilities, rules..."
              className="bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none w-full"
            />
          </div>
        </div>
      </div>

      {/* Amenities Grid */}
      <div className="bg-white rounded-lg border border-surface-border shadow-sm overflow-hidden">
        <div className="p-4 border-b border-surface-border bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-500" />
            <h2 className="font-bold text-navy text-sm">Community Facilities Directory ({filteredAmenities.length})</h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">Source of truth for WhatsApp queries</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading facility records...</div>
        ) : filteredAmenities.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <p className="text-sm font-semibold">No facilities found matching your criteria.</p>
            <p className="text-xs text-slate-400">Click "Add Facility" to register a gym, pool, or hall.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredAmenities.map((amenity) => (
              <div
                key={amenity.id}
                className="p-5 hover:bg-slate-50/80 transition-colors flex flex-col md:flex-row md:items-start justify-between gap-4"
              >
                <div className="flex items-start gap-4 flex-1">
                  {/* Category Icon */}
                  <div className="w-11 h-11 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200 mt-0.5">
                    {getAmenityIcon(amenity.name)}
                  </div>

                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-slate-800 text-sm">{amenity.name}</h3>

                      {amenity.is_bookable ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                          Reservation Required
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Open Drop-In Access
                        </span>
                      )}
                    </div>

                    {amenity.description && (
                      <p className="text-xs text-slate-600 leading-relaxed">{amenity.description}</p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap pt-1">
                      <span className="flex items-center gap-1 font-mono text-[11px] text-slate-700 font-semibold bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {amenity.timings || '06:00 - 22:00'}
                      </span>

                      {amenity.capacity && (
                        <span className="flex items-center gap-1 text-[11px] text-slate-600">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          Capacity: <strong>{amenity.capacity} people</strong>
                        </span>
                      )}
                    </div>

                    {/* Community Rules */}
                    {amenity.rules && (
                      <div className="mt-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600 space-y-1">
                        <span className="font-bold text-slate-700 flex items-center gap-1 text-[11px]">
                          <ShieldCheck className="w-3.5 h-3.5 text-brand-600" /> Facility Rules & Guidelines:
                        </span>
                        <p className="whitespace-pre-wrap">{amenity.rules}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 self-end md:self-start">
                  <button
                    onClick={() => setEditingAmenity(amenity)}
                    className="p-1.5 text-slate-500 hover:text-navy hover:bg-slate-100 rounded transition-colors"
                    title="Edit Facility Details"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeletingAmenity(amenity)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                    title="Delete Facility"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ADD FACILITY MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-navy/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-surface-border">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-brand-500" />
                <h3 className="font-bold text-navy text-base">Add Community Facility</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Facility Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rooftop Swimming Pool"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-brand-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Operating Hours / Timings *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 06:00 - 22:00 Daily (Ladies: 14:00 - 17:00)"
                  value={formData.timings}
                  onChange={(e) => setFormData({ ...formData, timings: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-brand-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Max Capacity (People)</label>
                  <input
                    type="number"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 font-mono focus:outline-none focus:border-brand-500 focus:bg-white"
                  />
                </div>

                <div className="flex flex-col justify-center pt-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_bookable}
                      onChange={(e) => setFormData({ ...formData, is_bookable: e.target.checked })}
                      className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300"
                    />
                    <span className="text-xs font-bold text-slate-700">Requires Advance Booking</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Facility features, location, and equipment available."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-brand-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Community Rules & Guidelines</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Proper swimwear required. Children must be accompanied by adults. No loud music after 22:00."
                  value={formData.rules}
                  onChange={(e) => setFormData({ ...formData, rules: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-brand-500 focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Add Facility'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT FACILITY MODAL */}
      {editingAmenity && (
        <div className="fixed inset-0 bg-navy/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-surface-border">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-brand-500" />
                <h3 className="font-bold text-navy text-base">Edit Facility</h3>
              </div>
              <button
                onClick={() => setEditingAmenity(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Facility Name *</label>
                <input
                  type="text"
                  required
                  value={editingAmenity.name || ''}
                  onChange={(e) => setEditingAmenity({ ...editingAmenity, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-brand-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Operating Hours / Timings *</label>
                <input
                  type="text"
                  required
                  value={editingAmenity.timings || ''}
                  onChange={(e) => setEditingAmenity({ ...editingAmenity, timings: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-brand-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Max Capacity (People)</label>
                  <input
                    type="number"
                    value={editingAmenity.capacity || 0}
                    onChange={(e) => setEditingAmenity({ ...editingAmenity, capacity: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 font-mono focus:outline-none focus:border-brand-500 focus:bg-white"
                  />
                </div>

                <div className="flex flex-col justify-center pt-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(editingAmenity.is_bookable)}
                      onChange={(e) => setEditingAmenity({ ...editingAmenity, is_bookable: e.target.checked })}
                      className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300"
                    />
                    <span className="text-xs font-bold text-slate-700">Requires Advance Booking</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={editingAmenity.description || ''}
                  onChange={(e) => setEditingAmenity({ ...editingAmenity, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-brand-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Community Rules & Guidelines</label>
                <textarea
                  rows={3}
                  value={editingAmenity.rules || ''}
                  onChange={(e) => setEditingAmenity({ ...editingAmenity, rules: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-brand-500 focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingAmenity(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Updating...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingAmenity && (
        <div className="fixed inset-0 bg-navy/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-2xl border border-surface-border space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-navy text-sm">Remove Facility</h3>
                <p className="text-xs text-slate-500">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600">
              Are you sure you want to remove <span className="font-bold text-slate-800">{deletingAmenity.name}</span> from the amenities directory?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setDeletingAmenity(null)}
                className="px-4 py-2 bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-rose-600 text-white text-xs font-semibold rounded-lg hover:bg-rose-700 transition-colors"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
