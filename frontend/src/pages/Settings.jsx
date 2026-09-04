import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Building2,
  CreditCard,
  ShieldAlert,
  Bot,
  Server,
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
  Sparkles,
  Info,
  Check,
  X
} from 'lucide-react';
import { fetchSettingsApi, updateSettingsApi } from '../services/api';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('society');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [settingsData, setSettingsData] = useState(null);

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
    { id: 'ai', name: 'AI WhatsApp Engine', icon: Bot },
    { id: 'system', name: 'Cloud & System Health', icon: Server },
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
          <h1 className="text-2xl font-bold text-navy tracking-tight flex items-center gap-2.5">
            <SettingsIcon className="w-6 h-6 text-brand-500" />
            Society Settings & Configuration
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Configure community profile, financial parameters, gatekeeper rules, and AI engine status.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadSettings}
            className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 bg-navy text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save All Changes'}
          </button>
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
          <div className="bg-white rounded-lg border border-surface-border shadow-sm p-6 space-y-6">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-navy flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-brand-500" />
                Maintenance Rates & Hamsayaa SaaS Billing
              </h2>
              <p className="text-xs text-slate-500">Per-unit monthly charges and invoice generation rules.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Base Monthly Maintenance (PKR)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs text-slate-400 font-bold">Rs.</span>
                  <input
                    type="number"
                    value={formData.base_maintenance_fee}
                    onChange={(e) => setFormData({ ...formData, base_maintenance_fee: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-3 py-2 text-xs text-slate-800 font-mono font-bold focus:outline-none focus:border-brand-500 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Hamsayaa SaaS Per-Unit Fee (PKR)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs text-slate-400 font-bold">Rs.</span>
                  <input
                    type="number"
                    value={formData.hamsayaa_per_unit_rate}
                    onChange={(e) => setFormData({ ...formData, hamsayaa_per_unit_rate: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-3 py-2 text-xs text-slate-800 font-mono font-bold focus:outline-none focus:border-brand-500 focus:bg-white"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">Billed to society management committee</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Late Surcharge Penalty (PKR)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs text-slate-400 font-bold">Rs.</span>
                  <input
                    type="number"
                    value={formData.late_payment_surcharge}
                    onChange={(e) => setFormData({ ...formData, late_payment_surcharge: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-3 py-2 text-xs text-slate-800 font-mono font-bold focus:outline-none focus:border-brand-500 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Default Invoice Due Day</label>
                <select
                  value={formData.due_day_of_month}
                  onChange={(e) => setFormData({ ...formData, due_day_of_month: parseInt(e.target.value) || 10 })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-brand-500 focus:bg-white"
                >
                  {[5, 10, 15, 20, 25, 28].map((d) => (
                    <option key={d} value={d}>{d}th of every month</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

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

      {/* TAB 4: AI WHATSAPP ENGINE */}
      {activeTab === 'ai' && (
        <div className="bg-white rounded-lg border border-surface-border shadow-sm p-6 space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-navy flex items-center gap-2">
              <Bot className="w-4 h-4 text-brand-500" />
              Google Gemini 2.0 & Meta WhatsApp Cloud Engine
            </h2>
            <p className="text-xs text-slate-500">Conversational reasoning, multilingual pipelines, and guardrails.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-xs text-slate-400 font-medium">Active LLM Model</span>
              <div className="font-bold text-navy text-sm font-mono flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                {settingsData?.ai_engine?.gemini_model || 'gemini-3.5-flash-lite'}
              </div>
              <p className="text-[11px] text-slate-500">Multimodal reasoning for text, Urdu audio, and Roman Urdu understanding.</p>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-xs text-slate-400 font-medium">Meta WhatsApp Phone Number ID</span>
              <div className="font-bold text-slate-800 text-sm font-mono">
                {settingsData?.meta_whatsapp?.phone_number_id || '1229806946879920'}
              </div>
              <p className="text-[11px] text-slate-500">Status: <span className="text-emerald-700 font-semibold">Active & Webhook Listening</span></p>
            </div>
          </div>

          <div className="space-y-4 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800 text-xs block">Resident Complaint Self-Closure</span>
                <span className="text-[11px] text-slate-500">
                  Allow residents to cancel or mark their own tickets resolved on WhatsApp by saying "close my complaint".
                </span>
              </div>
              <input
                type="checkbox"
                checked={formData.resident_closure_enabled}
                onChange={(e) => setFormData({ ...formData, resident_closure_enabled: e.target.checked })}
                className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800 text-xs block">Smart Duplicate Complaint Matching</span>
                <span className="text-[11px] text-slate-500">
                  Detect active society issues (lifts, generators, power) and return existing ticket IDs without database clutter.
                </span>
              </div>
              <input
                type="checkbox"
                checked={formData.smart_duplicate_matching_enabled}
                onChange={(e) => setFormData({ ...formData, smart_duplicate_matching_enabled: e.target.checked })}
                className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: SYSTEM & CLOUD HEALTH */}
      {activeTab === 'system' && (
        <div className="bg-white rounded-lg border border-surface-border shadow-sm p-6 space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-navy flex items-center gap-2">
              <Server className="w-4 h-4 text-brand-500" />
              Infrastructure & Cloud Connectivity
            </h2>
            <p className="text-xs text-slate-500">Status of connected databases, object storage, and serverless cache.</p>
          </div>

          <div className="space-y-3">
            <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-slate-800 text-xs block">Managed PostgreSQL (Supabase)</span>
                  <span className="text-[11px] text-slate-500 font-mono">your-project-id.supabase.co</span>
                </div>
              </div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
                Connected
              </span>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-slate-800 text-xs block">Object Storage (Supabase Storage)</span>
                  <span className="text-[11px] text-slate-500 font-mono">society-voice-notes/ (Public Bucket)</span>
                </div>
              </div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
                Active
              </span>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-slate-800 text-xs block">Session Memory (Upstash Redis REST)</span>
                  <span className="text-[11px] text-slate-500 font-mono">24-hour sliding TTL (chat_history:phone)</span>
                </div>
              </div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
                Healthy
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
