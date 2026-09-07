import React, { useState, useEffect } from 'react';
import {
  Building2,
  CreditCard,
  ShieldAlert,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Phone,
  Clock,
  Car,
  FileSpreadsheet,
  Zap,
  Info,
  Check,
  X,
  UserCog,
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff
} from 'lucide-react';
import { fetchSettingsApi, updateSettingsApi, fetchAdminsApi, createAdminApi, updateAdminApi, deleteAdminApi } from '../services/api';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('society');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [settingsData, setSettingsData] = useState(null);

  // Admin Users State
  const [admins, setAdmins] = useState([]);
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [adminSaving, setAdminSaving] = useState(false);
  const [adminDeleting, setAdminDeleting] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [adminForm, setAdminForm] = useState({ name: '', email: '', password: '', phone: '', role: 'admin', is_active: true });
  const [adminError, setAdminError] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    // Society Profile
    name: 'Lakeview Apartments',
    address: 'Plot 42, Block 13-A, Gulshan-e-Iqbal, Karachi',
    total_units: 50,
    hamsayaa_per_unit_rate: 150.00,
    emergency_helpline: '+92 300 1234567',
    security_gate_intercom: '100',

    // Financial & Banking
    bank_name: 'Meezan Bank Limited',
    account_title: 'Lakeview Residents Management Committee',
    account_number: 'PK42MEZN00012345678901',
    base_maintenance_fee: 8500.00,
    late_payment_surcharge: 500.00,
    due_day_of_month: 10,

    // Gate & Security
    visitor_pass_validity_hours: 4,
    overstay_alert_threshold_hours: 3,
    auto_flag_unregistered_vehicles: true,

    // AI & WhatsApp Automation
    resident_closure_enabled: true,
    smart_duplicate_matching_enabled: true
  });

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (activeTab === 'admins') loadAdmins();
  }, [activeTab]);

  const loadAdmins = async () => {
    setAdminsLoading(true);
    const data = await fetchAdminsApi();
    setAdmins(data || []);
    setAdminsLoading(false);
  };

  const handleSaveAdmin = async () => {
    setAdminError('');
    if (!adminForm.name || !adminForm.email) {
      setAdminError('Name and email are required');
      return;
    }
    if (!editingAdmin && !adminForm.password) {
      setAdminError('Password is required for new admin');
      return;
    }
    const payload = { ...adminForm };
    if (editingAdmin && !payload.password) delete payload.password;
    
    setAdminSaving(true);
    try {
      const res = editingAdmin 
        ? await updateAdminApi(editingAdmin.id, payload)
        : await createAdminApi(payload);
      
      if (res && res.status === 'error') {
        setAdminError(res.message || 'Failed to save admin to database');
        return;
      }
      setShowAdminModal(false);
      const savedName = payload.name;
      const isEdit = !!editingAdmin;
      setEditingAdmin(null);
      setAdminForm({ name: '', email: '', password: '', phone: '', role: 'admin', is_active: true });
      await loadAdmins();
      setFeedbackMsg(isEdit ? `Admin "${savedName}" updated in database successfully!` : `Admin "${savedName}" saved to database successfully!`);
      setTimeout(() => setFeedbackMsg(''), 4000);
    } catch (err) {
      setAdminError('An error occurred while saving to database.');
    } finally {
      setAdminSaving(false);
    }
  };

  const handleDeleteAdmin = async (adminId) => {
    setAdminDeleting(true);
    try {
      const res = await deleteAdminApi(adminId);
      if (res && res.status === 'error') {
        setAdminError(res.message || 'Failed to delete admin');
        return;
      }
      setShowDeleteConfirm(null);
      setAdminError('');
      await loadAdmins();
      setFeedbackMsg('Admin removed from database successfully.');
      setTimeout(() => setFeedbackMsg(''), 4000);
    } catch (err) {
      setAdminError('Failed to delete admin from database.');
    } finally {
      setAdminDeleting(false);
    }
  };

  const loadSettings = async () => {
    setLoading(true);
    const data = await fetchSettingsApi();
    if (data) {
      setSettingsData(data);
      const soc = data.society || {};
      const op = data.operational || {};
      setFormData({
        name: soc.name || 'Lakeview Apartments',
        address: soc.address || '',
        total_units: soc.total_units || 50,
        hamsayaa_per_unit_rate: soc.hamsayaa_per_unit_rate || 150.00,
        emergency_helpline: op.emergency_helpline || '+92 300 1234567',
        security_gate_intercom: op.security_gate_intercom || '100',
        bank_name: op.bank_name || 'Meezan Bank Limited',
        account_title: op.account_title || '',
        account_number: op.account_number || '',
        base_maintenance_fee: op.base_maintenance_fee || 8500.00,
        late_payment_surcharge: op.late_payment_surcharge || 500.00,
        due_day_of_month: op.due_day_of_month || 10,
        visitor_pass_validity_hours: op.visitor_pass_validity_hours || 4,
        overstay_alert_threshold_hours: op.overstay_alert_threshold_hours || 3,
        auto_flag_unregistered_vehicles: op.auto_flag_unregistered_vehicles ?? true,
        resident_closure_enabled: op.resident_closure_enabled ?? true,
        smart_duplicate_matching_enabled: op.smart_duplicate_matching_enabled ?? true
      });
    }
    setLoading(false);
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    setSaving(true);
    const res = await updateSettingsApi(formData);
    if (res) {
      setFeedbackMsg('Settings and parameters saved successfully!');
      setTimeout(() => setFeedbackMsg(''), 4000);
    }
    setSaving(false);
  };

  const tabs = [
    { id: 'society', name: 'Society Profile', icon: Building2 },
    { id: 'billing', name: 'Billing & Banking', icon: CreditCard },
    { id: 'security', name: 'Gate & Visitor Rules', icon: ShieldAlert },
    { id: 'admins', name: 'Admin Users', icon: UserCog },
  ];

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
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
          <h1 className="text-2xl font-bold text-navy tracking-tight">Society Settings & Configuration</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Configure community profile, financial parameters, gatekeeper rules, and AI engine status.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={activeTab === 'admins' ? loadAdmins : loadSettings}
            className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-medium text-xs rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${(activeTab === 'admins' ? adminsLoading : loading) ? 'animate-spin' : ''}`} /> Refresh
          </button>
          {activeTab !== 'admins' && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3.5 py-2 bg-brand-500 hover:bg-brand-600 text-white font-semibold text-xs rounded-lg shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save All Changes'}
            </button>
          )}
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto pb-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap ${
                isActive
                  ? 'bg-navy text-white shadow-sm'
                  : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/80'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.name}
            </button>
          );
        })}
      </div>

      {/* TAB 1: SOCIETY PROFILE */}
      {activeTab === 'society' && (
        <div className="bg-white rounded-lg border border-surface-border shadow-sm p-6 space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-navy flex items-center gap-2">
              <Building2 className="w-4 h-4 text-brand-500" />
              Community & Organization Metadata
            </h2>
            <p className="text-xs text-slate-500">Official name, physical address, and community capacity.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Society Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-brand-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Total Residential Units</label>
              <input
                type="number"
                value={formData.total_units}
                onChange={(e) => setFormData({ ...formData, total_units: parseInt(e.target.value) || 0 })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 font-mono focus:outline-none focus:border-brand-500 focus:bg-white"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">Official Physical Address</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-brand-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Emergency Helpline (Resident WhatsApp Hotline)</label>
              <input
                type="text"
                value={formData.emergency_helpline}
                onChange={(e) => setFormData({ ...formData, emergency_helpline: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 font-mono focus:outline-none focus:border-brand-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Main Gatekeeper Intercom Extension</label>
              <input
                type="text"
                value={formData.security_gate_intercom}
                onChange={(e) => setFormData({ ...formData, security_gate_intercom: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 font-mono focus:outline-none focus:border-brand-500 focus:bg-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FINANCIAL & BILLING */}
      {activeTab === 'billing' && (
        <div className="space-y-6">
          {/* Society Bank Details */}
          <div className="bg-white rounded-lg border border-surface-border shadow-sm p-6 space-y-6">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-navy flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-brand-500" />
                Official Society Bank Account (Invoice Payment Voucher)
              </h2>
              <p className="text-xs text-slate-500">
                These credentials are automatically rendered to residents on WhatsApp when requesting dues or payment accounts.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Bank Name</label>
                <input
                  type="text"
                  placeholder="e.g. Meezan Bank Limited"
                  value={formData.bank_name}
                  onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-brand-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Account Title</label>
                <input
                  type="text"
                  placeholder="e.g. Lakeview Residents Management Committee"
                  value={formData.account_title}
                  onChange={(e) => setFormData({ ...formData, account_title: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-brand-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">IBAN / Account Number</label>
                <input
                  type="text"
                  placeholder="e.g. PK42MEZN00012345678901"
                  value={formData.account_number}
                  onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 font-mono focus:outline-none focus:border-brand-500 focus:bg-white"
                />
              </div>
            </div>

            {/* Live WhatsApp Bank Preview Card */}
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 space-y-1 font-mono text-xs">
              <span className="text-[10px] font-bold text-slate-400 font-sans uppercase tracking-wider block">
                Resident WhatsApp Preview
              </span>
              <p className="text-slate-800 font-bold">🏛️ *OFFICIAL SOCIETY BANK ACCOUNT*</p>
              <p className="text-slate-700">• Bank: *{formData.bank_name || 'Bank Name'}*</p>
              <p className="text-slate-700">• Title: *{formData.account_title || 'Account Title'}*</p>
              <p className="text-slate-700">• IBAN: `{formData.account_number || 'PKXX...'}`</p>
              <p className="text-slate-500 text-[11px] pt-1">
                _After transferring, please upload a photo of your receipt here to mark verified._
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: GATE & SECURITY POLICIES */}
      {activeTab === 'security' && (
        <div className="bg-white rounded-lg border border-surface-border shadow-sm p-6 space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-navy flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-brand-500" />
              Visitor Passes & Vehicle Overstay Security Thresholds
            </h2>
            <p className="text-xs text-slate-500">Security parameters enforced at the entrance gate.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">Visitor Pass Validity Window</label>
              <p className="text-[11px] text-slate-500">Maximum duration a generated pass code remains valid for entry.</p>
              <select
                value={formData.visitor_pass_validity_hours}
                onChange={(e) => setFormData({ ...formData, visitor_pass_validity_hours: parseInt(e.target.value) || 4 })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-brand-500 focus:bg-white"
              >
                <option value={2}>2 Hours</option>
                <option value={4}>4 Hours (Recommended)</option>
                <option value={8}>8 Hours</option>
                <option value={12}>12 Hours</option>
                <option value={24}>24 Hours</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">Vehicle Overstay Alert Threshold</label>
              <p className="text-[11px] text-slate-500">Hours before a guest vehicle inside the complex is flagged as overstaying.</p>
              <select
                value={formData.overstay_alert_threshold_hours}
                onChange={(e) => setFormData({ ...formData, overstay_alert_threshold_hours: parseInt(e.target.value) || 3 })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-brand-500 focus:bg-white"
              >
                <option value={2}>2 Hours</option>
                <option value={3}>3 Hours (Standard)</option>
                <option value={4}>4 Hours</option>
                <option value={6}>6 Hours</option>
              </select>
            </div>

            <div className="md:col-span-2 pt-2 border-t border-slate-100 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800 text-xs block">Auto-Flag Unregistered Vehicles</span>
                <span className="text-[11px] text-slate-500">
                  Automatically alert administration when a vehicle entering the gate is not in the resident registry.
                </span>
              </div>
              <input
                type="checkbox"
                checked={formData.auto_flag_unregistered_vehicles}
                onChange={(e) => setFormData({ ...formData, auto_flag_unregistered_vehicles: e.target.checked })}
                className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: ADMIN USERS */}
      {activeTab === 'admins' && (
        <div className="bg-white rounded-lg border border-surface-border shadow-sm p-6 space-y-6">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-navy flex items-center gap-2">
                <UserCog className="w-4 h-4 text-brand-500" />
                Admin Users
              </h2>
              <p className="text-xs text-slate-500">Manage dashboard access and administrator accounts.</p>
            </div>
            <button
              onClick={() => {
                setEditingAdmin(null);
                setAdminForm({ name: '', email: '', password: '', phone: '', role: 'admin', is_active: true });
                setAdminError('');
                setShowAdminPassword(false);
                setShowAdminModal(true);
              }}
              className="px-3.5 py-2 bg-brand-500 hover:bg-brand-600 text-white font-semibold text-xs rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add Admin
            </button>
          </div>

          {adminsLoading ? (
            <div className="flex justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 font-semibold rounded-tl-lg">Name</th>
                    <th className="px-4 py-3 font-semibold">Email</th>
                    <th className="px-4 py-3 font-semibold">Phone</th>
                    <th className="px-4 py-3 font-semibold">Role</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold text-right rounded-tr-lg">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {admins.map((adm) => (
                    <tr key={adm.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-navy">{adm.name}</td>
                      <td className="px-4 py-3 text-slate-600">{adm.email}</td>
                      <td className="px-4 py-3 text-slate-600">{adm.phone || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold capitalize ${
                          adm.role === 'super_admin'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                          {adm.role === 'super_admin' ? 'Super Admin' : adm.role ? adm.role.replace('_', ' ') : 'Admin'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          adm.is_active !== false
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                          {adm.is_active !== false ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setEditingAdmin(adm);
                              setAdminForm({
                                name: adm.name,
                                email: adm.email,
                                phone: adm.phone || '',
                                role: adm.role,
                                is_active: adm.is_active !== false,
                                password: ''
                              });
                              setAdminError('');
                              setShowAdminPassword(false);
                              setShowAdminModal(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-brand-500 hover:bg-slate-100 rounded transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(adm.id)}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {admins.length === 0 && (
                    <tr>
                      <td colSpan="6" className="px-4 py-8 text-center text-slate-500">
                        No admin users found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Admin Modal */}
      {showAdminModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveAdmin();
            }}
            autoComplete="off"
            className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden my-auto"
          >
            {/* Decoy fields to trap browser credential manager autofill */}
            <input type="text" name="fake_username_remember" style={{ display: 'none' }} tabIndex={-1} autoComplete="username" />
            <input type="password" name="fake_password_remember" style={{ display: 'none' }} tabIndex={-1} autoComplete="current-password" />

            <div className="shrink-0 p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-navy">
                {editingAdmin ? 'Edit Admin User' : 'Add Admin User'}
              </h3>
              <button
                type="button"
                onClick={() => setShowAdminModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {adminError && (
                <div className="p-3 bg-red-50 text-red-700 text-xs font-semibold rounded-lg border border-red-200 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{adminError}</span>
                </div>
              )}
              
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  name="new_admin_full_name"
                  autoComplete="off"
                  value={adminForm.name}
                  onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-brand-500 focus:bg-white"
                  placeholder="e.g. Tariq Mehmood"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  name="new_admin_email_address"
                  autoComplete="new-password"
                  value={adminForm.email}
                  onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-brand-500 focus:bg-white"
                  placeholder="tariq@hamsayaa.com"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {editingAdmin ? 'New Password (leave blank to keep current)' : 'Password *'}
                </label>
                <div className="relative">
                  <input
                    type={showAdminPassword ? 'text' : 'password'}
                    name="new_admin_secret_key"
                    autoComplete="new-password"
                    value={adminForm.password}
                    onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-3 pr-10 py-2 text-xs text-slate-800 focus:outline-none focus:border-brand-500 focus:bg-white"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPassword(!showAdminPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                  >
                    {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  name="new_admin_contact_number"
                  autoComplete="off"
                  value={adminForm.phone}
                  onChange={(e) => setAdminForm({ ...adminForm, phone: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-brand-500 focus:bg-white"
                  placeholder="+92 300 1234567"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Role</label>
                <select
                  value={adminForm.role}
                  onChange={(e) => setAdminForm({ ...adminForm, role: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-brand-500 focus:bg-white"
                >
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                  <option value="accountant">Accountant / Treasurer</option>
                  <option value="guard">Security Guard</option>
                </select>
              </div>

              {editingAdmin && (
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <div>
                    <span className="font-bold text-slate-800 text-xs block">Account Status</span>
                    <span className="text-[11px] text-slate-500">Allow this admin to log in to the dashboard.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={adminForm.is_active !== false}
                    onChange={(e) => setAdminForm({ ...adminForm, is_active: e.target.checked })}
                    className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300"
                  />
                </div>
              )}
            </div>
            
            <div className="shrink-0 p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowAdminModal(false)}
                disabled={adminSaving}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={adminSaving}
                className="px-4 py-2 bg-brand-500 text-white text-xs font-semibold rounded-lg shadow-sm hover:bg-brand-600 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {adminSaving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{editingAdmin ? 'Updating Database...' : 'Saving to Database...'}</span>
                  </>
                ) : (
                  <span>{editingAdmin ? 'Save Changes' : 'Create Admin'}</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-2">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-navy text-center">Delete Admin</h3>
            <p className="text-sm text-slate-600 text-center">
              Are you sure you want to delete this admin? This action cannot be undone.
            </p>
            {adminError && (
              <p className="text-xs text-red-600 text-center">{adminError}</p>
            )}
            <div className="flex justify-center gap-3 pt-2">
              <button
                onClick={() => {
                  setShowDeleteConfirm(null);
                  setAdminError('');
                }}
                disabled={adminDeleting}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteAdmin(showDeleteConfirm)}
                disabled={adminDeleting}
                className="px-4 py-2 bg-red-600 text-white text-xs font-semibold rounded-lg shadow-sm hover:bg-red-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {adminDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
