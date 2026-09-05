import React, { useState, useEffect } from 'react';
import {
  Wrench,
  Zap,
  ArrowUpDown,
  Droplets,
  Shield,
  Sun,
  Flame,
  Plus,
  Search,
  RefreshCw,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Edit2,
  Trash2,
  X,
  History,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import {
  fetchAssets,
  createAssetApi,
  updateAssetApi,
  deleteAssetApi,
  fetchMaintenanceLogsApi,
  createMaintenanceLogApi
} from '../services/api';

const PRESET_CATEGORIES = [
  'Generators & Power',
  'Elevators & Lifts',
  'Water & Plumbing Pumps',
  'Security & Surveillance',
  'Solar & Renewable',
  'Fire Safety & Extinguishers',
  'General Infrastructure'
];

export default function Assets() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('All');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [deletingAsset, setDeletingAsset] = useState(null);
  const [loggingServiceAsset, setLoggingServiceAsset] = useState(null);
  const [viewingHistoryAsset, setViewingHistoryAsset] = useState(null);
  const [maintenanceLogs, setMaintenanceLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Add Asset Form State
  const [formData, setFormData] = useState({
    name: '',
    category: 'Generators & Power',
    install_date: '',
    next_service_due: ''
  });

  // Log Service Form State
  const [serviceFormData, setServiceFormData] = useState({
    serviced_at: new Date().toISOString().slice(0, 10),
    notes: '',
    next_due_override: ''
  });

  const [submitting, setSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');

  // Initial Data Load
  useEffect(() => {
    loadAssetsData();
  }, []);

  const loadAssetsData = async () => {
    setLoading(true);
    const data = await fetchAssets();
    setAssets(data || []);
    setLoading(false);
  };

  // Helper for Category Icons
  const getCategoryIcon = (category = '') => {
    const c = category.toLowerCase();
    if (c.includes('generator') || c.includes('power')) return <Zap className="w-4 h-4 text-amber-500" />;
    if (c.includes('elevator') || c.includes('lift')) return <ArrowUpDown className="w-4 h-4 text-blue-500" />;
    if (c.includes('water') || c.includes('pump') || c.includes('plumb')) return <Droplets className="w-4 h-4 text-cyan-500" />;
    if (c.includes('security') || c.includes('cctv') || c.includes('surveillance')) return <Shield className="w-4 h-4 text-indigo-500" />;
    if (c.includes('solar') || c.includes('renewable')) return <Sun className="w-4 h-4 text-yellow-500" />;
    if (c.includes('fire')) return <Flame className="w-4 h-4 text-rose-500" />;
    return <Wrench className="w-4 h-4 text-slate-500" />;
  };

  // Health Status Calculator
  const getAssetHealth = (asset) => {
    if (asset.health_status) return asset.health_status;
    if (!asset.next_service_due) return 'operational';
    try {
      const today = new Date();
      const due = new Date(asset.next_service_due);
      const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) return 'overdue';
      if (diffDays <= 14) return 'due_soon';
      return 'operational';
    } catch {
      return 'operational';
    }
  };

  // Metrics
  const totalCount = assets.length;
  const overdueCount = assets.filter(a => getAssetHealth(a) === 'overdue').length;
  const dueSoonCount = assets.filter(a => getAssetHealth(a) === 'due_soon').length;
  const operationalCount = assets.filter(a => getAssetHealth(a) === 'operational').length;

  // Filtered Assets
  const filteredAssets = assets.filter((asset) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      (asset.name || '').toLowerCase().includes(q) ||
      (asset.category || '').toLowerCase().includes(q);

    const matchesCategory =
      selectedCategoryFilter === 'All' ||
      (asset.category || '').toLowerCase().includes(selectedCategoryFilter.toLowerCase());

    const health = getAssetHealth(asset);
    const matchesStatus =
      selectedStatusFilter === 'All' ||
      health === selectedStatusFilter;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Handle Create Asset
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) return;
    setSubmitting(true);

    const payload = {
      name: formData.name.trim(),
      category: formData.category.trim(),
      install_date: formData.install_date || null,
      next_service_due: formData.next_service_due || null
    };

    const res = await createAssetApi(payload);
    if (res && res.asset) {
      setAssets((prev) => [res.asset, ...prev]);
      setShowAddModal(false);
      setFormData({
        name: '',
        category: 'Generators & Power',
        install_date: '',
        next_service_due: ''
      });
      setFeedbackMsg('Asset registered successfully in directory!');
      setTimeout(() => setFeedbackMsg(''), 4000);
    }
    setSubmitting(false);
  };

  // Handle Edit Asset
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingAsset) return;
    setSubmitting(true);

    const payload = {
      name: editingAsset.name.trim(),
      category: editingAsset.category?.trim(),
      install_date: editingAsset.install_date || null,
      next_service_due: editingAsset.next_service_due || null
    };

    const res = await updateAssetApi(editingAsset.id, payload);
    if (res && res.asset) {
      setAssets((prev) =>
        prev.map((a) => (a.id === editingAsset.id ? { ...a, ...res.asset } : a))
      );
      setEditingAsset(null);
      setFeedbackMsg('Asset details updated successfully!');
      setTimeout(() => setFeedbackMsg(''), 4000);
    }
    setSubmitting(false);
  };

  // Handle Delete Asset
  const handleDeleteConfirm = async () => {
    if (!deletingAsset) return;
    const astId = deletingAsset.id;
    await deleteAssetApi(astId);
    setAssets((prev) => prev.filter((a) => a.id !== astId));
    setDeletingAsset(null);
    setFeedbackMsg('Asset removed from directory.');
    setTimeout(() => setFeedbackMsg(''), 4000);
  };

  // Open Service Log Modal
  const handleOpenLogService = (asset) => {
    setLoggingServiceAsset(asset);
    // Suggest next due date 90 days out
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + 90);
    setServiceFormData({
      serviced_at: new Date().toISOString().slice(0, 10),
      notes: '',
      next_due_override: nextDate.toISOString().slice(0, 10)
    });
  };

  // Handle Submit Service Log
  const handleServiceLogSubmit = async (e) => {
    e.preventDefault();
    if (!loggingServiceAsset || !serviceFormData.notes) return;
    setSubmitting(true);

    const payload = {
      serviced_at: serviceFormData.serviced_at,
      notes: serviceFormData.notes.trim(),
      next_due_override: serviceFormData.next_due_override || null
    };

    const res = await createMaintenanceLogApi(loggingServiceAsset.id, payload);
    if (res && res.log) {
      // Update local asset's next_service_due
      if (payload.next_due_override) {
        setAssets((prev) =>
          prev.map((a) =>
            a.id === loggingServiceAsset.id
              ? { ...a, next_service_due: payload.next_due_override, health_status: 'operational' }
              : a
          )
        );
      }
      setLoggingServiceAsset(null);
      setFeedbackMsg('Maintenance service logged successfully!');
      setTimeout(() => setFeedbackMsg(''), 4000);
    }
    setSubmitting(false);
  };

  // Open Maintenance History Modal
  const handleOpenHistory = async (asset) => {
    setViewingHistoryAsset(asset);
    setLoadingLogs(true);
    const logs = await fetchMaintenanceLogsApi(asset.id);
    setMaintenanceLogs(logs || []);
    setLoadingLogs(false);
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
            <Wrench className="w-6 h-6 text-brand-500" />
            Asset Directory & Maintenance
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Preventive service scheduling and maintenance records for society infrastructure.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadAssetsData}
            className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-1.5 bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Add Asset
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-surface-border shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-navy shrink-0">
            <Wrench className="w-5 h-5 text-slate-700" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Total Society Assets</div>
            <div className="text-xl font-bold text-navy">{totalCount}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-surface-border shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Operational & Healthy</div>
            <div className="text-xl font-bold text-emerald-700">{operationalCount}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-surface-border shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Service Due Soon</div>
            <div className="text-xl font-bold text-amber-700">{dueSoonCount}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-surface-border shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Overdue Service</div>
            <div className="text-xl font-bold text-rose-700">{overdueCount}</div>
          </div>
        </div>
      </div>

      {/* Category & Status Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-1 overflow-x-auto">
          {['All', 'Generators', 'Elevators', 'Water', 'Security', 'Solar'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategoryFilter(cat)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                selectedCategoryFilter === cat
                  ? 'bg-navy text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat === 'All' ? 'All Categories' : cat}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* Health Status Filter */}
          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            className="bg-white border border-slate-200 text-xs font-medium text-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none shadow-xs"
          >
            <option value="All">All Health Statuses</option>
            <option value="operational">Operational</option>
            <option value="due_soon">Service Due Soon</option>
            <option value="overdue">Overdue Service</option>
          </select>

          {/* Search Input */}
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 w-60 shadow-xs">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search assets, categories..."
              className="bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none w-full"
            />
          </div>
        </div>
      </div>

      {/* Assets Grid */}
      <div className="bg-white rounded-lg border border-surface-border shadow-sm overflow-hidden">
        <div className="p-4 border-b border-surface-border bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-brand-500" />
            <h2 className="font-bold text-navy text-sm">Society Asset Registry ({filteredAssets.length})</h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">Preventive Maintenance Schedule</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading asset directory...</div>
        ) : filteredAssets.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <p className="text-sm font-semibold">No assets match your search criteria.</p>
            <p className="text-xs text-slate-400">Click "Add Asset" to register community generators, lifts, or pumps.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredAssets.map((asset) => {
              const health = getAssetHealth(asset);
              const isOverdue = health === 'overdue';
              const isDueSoon = health === 'due_soon';

              return (
                <div
                  key={asset.id}
                  className="p-4 hover:bg-slate-50/80 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5 flex-1">
                    {/* Category Icon */}
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200 mt-0.5">
                      {getCategoryIcon(asset.category)}
                    </div>

                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-800 text-sm">{asset.name}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {asset.category || 'General'}
                        </span>

                        {/* Health Badge */}
                        {isOverdue ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-rose-600" /> Overdue Service
                          </span>
                        ) : isDueSoon ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-600" /> Service Due Soon
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Operational
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                        {asset.install_date && (
                          <span className="flex items-center gap-1 font-mono text-[11px] text-slate-500">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            Installed: {String(asset.install_date).slice(0, 10)}
                          </span>
                        )}

                        <span className={`flex items-center gap-1 font-mono text-[11px] font-semibold ${
                          isOverdue ? 'text-rose-600' : isDueSoon ? 'text-amber-700' : 'text-slate-600'
                        }`}>
                          <Clock className="w-3.5 h-3.5" />
                          Next Service: {asset.next_service_due ? String(asset.next_service_due).slice(0, 10) : 'Not Scheduled'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end md:self-center">
                    <button
                      onClick={() => handleOpenLogService(asset)}
                      className="px-2.5 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 border border-brand-200 shadow-xs"
                      title="Record Maintenance Service"
                    >
                      <Wrench className="w-3.5 h-3.5" /> Log Service
                    </button>
                    <button
                      onClick={() => handleOpenHistory(asset)}
                      className="p-1.5 text-slate-500 hover:text-navy hover:bg-slate-100 rounded transition-colors"
                      title="View Maintenance History"
                    >
                      <History className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setEditingAsset(asset)}
                      className="p-1.5 text-slate-500 hover:text-navy hover:bg-slate-100 rounded transition-colors"
                      title="Edit Asset"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeletingAsset(asset)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                      title="Delete Asset"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ADD ASSET MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-navy/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-surface-border">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-brand-500" />
                <h3 className="font-bold text-navy text-base">Register Society Asset</h3>
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
                <label className="block text-xs font-bold text-slate-700 mb-1">Asset Name / Description *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 250 kVA Standby Diesel Generator"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-brand-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Category *</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-brand-500 focus:bg-white"
                >
                  {PRESET_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Install Date</label>
                  <input
                    type="date"
                    value={formData.install_date}
                    onChange={(e) => setFormData({ ...formData, install_date: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-brand-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Next Service Due</label>
                  <input
                    type="date"
                    value={formData.next_service_due}
                    onChange={(e) => setFormData({ ...formData, next_service_due: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-brand-500 focus:bg-white"
                  />
                </div>
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
                  {submitting ? 'Registering...' : 'Register Asset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT ASSET MODAL */}
      {editingAsset && (
        <div className="fixed inset-0 bg-navy/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-surface-border">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-brand-500" />
                <h3 className="font-bold text-navy text-base">Edit Asset Details</h3>
              </div>
              <button
                onClick={() => setEditingAsset(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Asset Name *</label>
                <input
                  type="text"
                  required
                  value={editingAsset.name || ''}
                  onChange={(e) => setEditingAsset({ ...editingAsset, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-brand-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Category *</label>
                <select
                  value={editingAsset.category || 'Generators & Power'}
                  onChange={(e) => setEditingAsset({ ...editingAsset, category: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-brand-500 focus:bg-white"
                >
                  {PRESET_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Install Date</label>
                  <input
                    type="date"
                    value={editingAsset.install_date ? String(editingAsset.install_date).slice(0, 10) : ''}
                    onChange={(e) => setEditingAsset({ ...editingAsset, install_date: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-brand-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Next Service Due</label>
                  <input
                    type="date"
                    value={editingAsset.next_service_due ? String(editingAsset.next_service_due).slice(0, 10) : ''}
                    onChange={(e) => setEditingAsset({ ...editingAsset, next_service_due: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-brand-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingAsset(null)}
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

      {/* LOG MAINTENANCE SERVICE MODAL */}
      {loggingServiceAsset && (
        <div className="fixed inset-0 bg-navy/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-surface-border">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-brand-500" />
                <div>
                  <h3 className="font-bold text-navy text-base">Record Maintenance Service</h3>
                  <p className="text-xs text-slate-500">{loggingServiceAsset.name}</p>
                </div>
              </div>
              <button
                onClick={() => setLoggingServiceAsset(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleServiceLogSubmit} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Service Date *</label>
                <input
                  type="date"
                  required
                  value={serviceFormData.serviced_at}
                  onChange={(e) => setServiceFormData({ ...serviceFormData, serviced_at: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-brand-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Work Done / Technician Notes *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Changed oil, replaced air and fuel filters. Tested generator load."
                  value={serviceFormData.notes}
                  onChange={(e) => setServiceFormData({ ...serviceFormData, notes: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-brand-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Next Service Due Date</label>
                <input
                  type="date"
                  value={serviceFormData.next_due_override}
                  onChange={(e) => setServiceFormData({ ...serviceFormData, next_due_override: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-brand-500 focus:bg-white"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Setting this will automatically advance the asset's next service schedule.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setLoggingServiceAsset(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Saving Log...' : 'Record Service Log'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW MAINTENANCE HISTORY MODAL */}
      {viewingHistoryAsset && (
        <div className="fixed inset-0 bg-navy/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl border border-surface-border space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-brand-500" />
                <div>
                  <h3 className="font-bold text-navy text-base">Service History Timeline</h3>
                  <p className="text-xs text-slate-500">{viewingHistoryAsset.name}</p>
                </div>
              </div>
              <button
                onClick={() => setViewingHistoryAsset(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {loadingLogs ? (
              <div className="py-8 text-center text-xs text-slate-400">Loading service logs...</div>
            ) : maintenanceLogs.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500 space-y-1">
                <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="font-semibold">No maintenance logs recorded yet.</p>
                <p className="text-slate-400">Click "Log Service" on the asset card to record maintenance work.</p>
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto space-y-3 pr-1">
                {maintenanceLogs.map((log) => (
                  <div key={log.id} className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
                    <div className="flex items-center justify-between text-slate-500 font-mono text-[11px]">
                      <span className="font-bold text-slate-700">
                        Serviced on: {String(log.serviced_at).slice(0, 10)}
                      </span>
                      {log.next_due_override && (
                        <span className="text-emerald-700 font-semibold">
                          Next due set to: {String(log.next_due_override).slice(0, 10)}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-800 whitespace-pre-wrap">{log.notes}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setViewingHistoryAsset(null)}
                className="px-4 py-2 bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingAsset && (
        <div className="fixed inset-0 bg-navy/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-2xl border border-surface-border space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-navy text-sm">Remove Asset Record</h3>
                <p className="text-xs text-slate-500">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600">
              Are you sure you want to remove <span className="font-bold text-slate-800">{deletingAsset.name}</span> from the asset directory? All associated service logs will also be deleted.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setDeletingAsset(null)}
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
