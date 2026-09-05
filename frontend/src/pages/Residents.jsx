import React, { useState, useEffect } from 'react';
import {
  Users,
  Building,
  Plus,
  FileSpreadsheet,
  Search,
  Filter,
  ShieldAlert,
  CheckCircle,
  Ban,
  MessageSquare,
  X,
  UploadCloud,
  Car,
  Phone,
  UserCheck,
  RefreshCw,
  Bell,
  RotateCw,
  AlertTriangle
} from 'lucide-react';
import { mockBuildings, mockResidents } from '../services/mockData';
import {
  fetchResidents,
  createResidentApi,
  toggleBlockResidentApi,
  bulkImportResidentsApi,
  broadcastResidentNotificationApi
} from '../services/api';

const NOTIFICATION_PRESETS = [
  {
    id: 'general',
    label: '📢 General Notice',
    category: 'General',
    defaultTitle: 'Society Community Announcement',
    defaultMessage: 'Dear Residents, please be informed of the following update from the society management office.',
  },
  {
    id: 'water',
    label: '🚰 Water Supply',
    category: 'Water Supply',
    defaultTitle: 'Scheduled Water Supply Maintenance',
    defaultMessage: 'Water supply to the overhead distribution tanks will be paused today from 2:00 PM to 5:00 PM for scheduled pipeline maintenance. Please store sufficient water for your household needs.',
  },
  {
    id: 'power',
    label: '⚡ Power / Generator',
    category: 'Power & Generator',
    defaultTitle: 'Backup Generator Testing Notice',
    defaultMessage: 'The society backup generator will undergo routine load testing today between 3:00 PM and 4:00 PM. Minor power switchover delays of 1-2 minutes may occur.',
  },
  {
    id: 'security',
    label: '🛡️ Security Advisory',
    category: 'Security',
    defaultTitle: 'Gate Security & Visitor Pass Advisory',
    defaultMessage: 'Please generate a digital gate pass via our WhatsApp assistant before expecting visiting guests or delivery riders to ensure swift security gate entry.',
  },
  {
    id: 'sanitation',
    label: '🧹 Fumigation & Sanitation',
    category: 'Sanitation',
    defaultTitle: 'Mosquito Fumigation Schedule',
    defaultMessage: 'Dengue spray and fumigation will be conducted across all building corridors and common parking areas today starting at 6:00 PM. Please keep windows and balconies closed.',
  },
  {
    id: 'maintenance',
    label: '🛠️ Facility Repair',
    category: 'Maintenance',
    defaultTitle: 'Elevator Routine Service',
    defaultMessage: 'Passenger Lift #1 will be taken offline for quarterly safety inspection from 11:00 AM to 1:00 PM today. Please use Passenger Lift #2 or common stairs.',
  },
];

export default function Residents() {
  const [selectedBuilding, setSelectedBuilding] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [residents, setResidents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [isSendingNotification, setIsSendingNotification] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState(null);

  // Broadcast Notification Form State
  const [notificationForm, setNotificationForm] = useState({
    scope: 'all', // 'all' or 'building'
    building: 'Block A',
    category: 'General',
    title: '',
    message: '',
  });

  // Add Form State
  const [formData, setFormData] = useState({
    building: 'Block A',
    unit_number: '',
    name: '',
    phone_number: '+92300',
    cnic: '',
    is_owner: true,
    is_tenant: false,
    vehicle_plate: '',
  });

  // Bulk Upload File
  const [importFile, setImportFile] = useState(null);

  // Automatic Loading on Initial Mount and Building Filter Change
  useEffect(() => {
    loadResidentsList(selectedBuilding);
  }, [selectedBuilding]);

  const loadResidentsList = async (bld) => {
    setLoading(true);
    const data = await fetchResidents(bld);
    setResidents(data || mockResidents);
    setLoading(false);
  };

  // Filtered residents by search query
  const filteredResidents = residents.filter((r) => {
    const q = searchQuery.toLowerCase();
    const bldStr = r.building || 'Block A';
    const unitStr = `${bldStr} ${r.unitNumber || r.unit_number || ''}`.toLowerCase();
    const nameStr = (r.name || '').toLowerCase();
    const phoneStr = (r.phoneNumber || r.phone_number || '').toLowerCase();
    return unitStr.includes(q) || nameStr.includes(q) || phoneStr.includes(q);
  });

  // Handle Manual Block Toggle
  const handleToggleBlock = async (residentId, currentStatus) => {
    const newStatus = !currentStatus;
    setResidents((prev) =>
      prev.map((r) => (r.id === residentId ? { ...r, isBlocked: newStatus, is_blocked: newStatus } : r))
    );
    await toggleBlockResidentApi(residentId, newStatus);
  };

  // Handle Create Resident Submit
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!formData.unit_number || !formData.name || !formData.phone_number) return;

    let cleanPhone = formData.phone_number.strip ? formData.phone_number.strip() : formData.phone_number;
    if (!cleanPhone.startsWith('+')) cleanPhone = '+' + cleanPhone;

    const newResident = {
      id: `r-${Date.now()}`,
      building: formData.building,
      unitNumber: formData.unit_number,
      unit_number: formData.unit_number,
      name: formData.name,
      phoneNumber: cleanPhone,
      phone_number: cleanPhone,
      cnic: formData.cnic,
      isOwner: formData.is_owner,
      is_owner: formData.is_owner,
      isTenant: formData.is_tenant,
      is_tenant: formData.is_tenant,
      isBlocked: false,
      is_blocked: false,
      registeredVehicles: formData.vehicle_plate ? [formData.vehicle_plate] : [],
    };

    setResidents((prev) => [newResident, ...prev]);
    setShowAddModal(false);
    await createResidentApi({
      ...formData,
      phone_number: cleanPhone
    });
    setFormData({
      building: 'Block A',
      unit_number: '',
      name: '',
      phone_number: '+92300',
      cnic: '',
      is_owner: true,
      is_tenant: false,
      vehicle_plate: '',
    });
  };

  // Handle Bulk Upload Submit
  const handleImportSubmit = async (e) => {
    e.preventDefault();
    if (!importFile) return;

    await bulkImportResidentsApi(importFile);
    alert(`Successfully imported residents from ${importFile.name}`);
    setShowImportModal(false);
    setImportFile(null);
    loadResidentsList(selectedBuilding);
  };

  // Available unique buildings for targeting
  const uniqueBuildings = Array.from(new Set(residents.map((r) => r.building).filter(Boolean)));
  const availableBuildings = uniqueBuildings.length > 0 ? uniqueBuildings : ['Block A', 'Block B', 'Block C'];

  // Calculate live eligible target count for notification
  const targetResidentsCount = notificationForm.scope === 'all'
    ? residents.filter((r) => !r.isBlocked && !r.is_blocked && (r.phoneNumber || r.phone_number)).length
    : residents.filter((r) => (r.building === notificationForm.building) && !r.isBlocked && !r.is_blocked && (r.phoneNumber || r.phone_number)).length;

  // Handle Dispatch Broadcast
  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    if (!notificationForm.title.trim() || !notificationForm.message.trim()) return;

    setIsSendingNotification(true);
    setBroadcastResult(null);

    const targetBuilding = notificationForm.scope === 'all' ? 'All' : notificationForm.building;
    const res = await broadcastResidentNotificationApi({
      title: notificationForm.title.trim(),
      message: notificationForm.message.trim(),
      building: targetBuilding,
      category: notificationForm.category,
    });

    setIsSendingNotification(false);
    setBroadcastResult(res);

    if (res && res.status !== 'error') {
      setTimeout(() => {
        setNotificationForm((prev) => ({ ...prev, title: '', message: '' }));
      }, 1500);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy tracking-tight">Residents & Building Roster</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage unit occupancy, WhatsApp bot access, and manual payment blocks.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadResidentsList(selectedBuilding)}
            className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-medium text-xs rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
            title="Refresh residents from database"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-brand-600' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => {
              setBroadcastResult(null);
              setShowNotificationModal(true);
            }}
            className="px-3.5 py-2 bg-navy hover:bg-navy/90 text-white font-semibold text-xs rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
            title="Broadcast WhatsApp notification to residents (society-wide or per building)"
          >
            <Bell className="w-3.5 h-3.5 text-brand-400" />
            <span>Send Notification</span>
          </button>

          <button
            onClick={() => setShowImportModal(true)}
            className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-medium text-xs rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-brand-600" />
            <span>Bulk Excel Roster</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-2 bg-brand-500 hover:bg-brand-600 text-white font-semibold text-xs rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Resident</span>
          </button>
        </div>
      </div>

      {/* Building / Block Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-2 flex items-center gap-1">
            <Building className="w-3.5 h-3.5" /> Building:
          </span>
          {mockBuildings.map((bld) => (
            <button
              key={bld}
              onClick={() => setSelectedBuilding(bld)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                selectedBuilding === bld
                  ? 'bg-navy text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {bld}
            </button>
          ))}
        </div>

        {/* Quick Search */}
        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 w-64 shadow-sm">
          <Search className="w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter name, unit, phone..."
            className="bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none w-full"
          />
        </div>
      </div>

      {/* Residents Table Container */}
      <div className="bg-white rounded-lg border border-surface-border shadow-sm overflow-hidden">
        <div className="p-4 border-b border-surface-border bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-brand-600" />
            <h2 className="font-bold text-navy text-sm">
              Occupancy Roster ({filteredResidents.length} Residents)
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Building Context: <strong className="text-navy">{selectedBuilding}</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-600 uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Building & Unit</th>
                <th className="px-4 py-3">Resident Name</th>
                <th className="px-4 py-3">WhatsApp Number</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Vehicles</th>
                <th className="px-4 py-3">Access Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredResidents.map((r) => {
                const isBlocked = r.isBlocked || r.is_blocked;
                const unit = r.unitNumber || r.unit_number;
                const bld = r.building || 'Block A';
                const phone = r.phoneNumber || r.phone_number;
                const isOwner = r.isOwner !== undefined ? r.isOwner : r.is_owner;
                const vehicles = r.registered_vehicles || r.registeredVehicles || [];

                return (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-semibold text-navy">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 font-mono text-[11px] mr-2">
                        {bld}
                      </span>
                      Unit {unit}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-800">{r.name}</p>
                      {r.cnic && <p className="text-[10px] text-slate-400 font-mono">CNIC: {r.cnic}</p>}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700">{phone}</td>
                    <td className="px-4 py-3">
                      {isOwner ? (
                        <span className="bg-brand-50 text-brand-700 border border-brand-200 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                          OWNER
                        </span>
                      ) : (
                        <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                          TENANT
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {vehicles.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {vehicles.map((v, i) => (
                            <span key={i} className="bg-slate-100 text-slate-700 font-mono px-1.5 py-0.5 rounded text-[10px] border border-slate-200">
                              {typeof v === 'object' ? `${v.vehicle_plate} (${v.vehicle_type})` : v}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[10px] font-italic">No vehicles</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isBlocked ? (
                        <span className="status-pill status-pill-overdue flex items-center gap-1 w-fit">
                          <Ban className="w-3 h-3" /> BLOCKED
                        </span>
                      ) : (
                        <span className="status-pill status-pill-paid flex items-center gap-1 w-fit">
                          <CheckCircle className="w-3 h-3" /> ACTIVE
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Manual Block Toggle */}
                        <button
                          onClick={() => handleToggleBlock(r.id, isBlocked)}
                          className={`px-2.5 py-1 text-[10px] font-bold rounded shadow-xs transition-colors ${
                            isBlocked
                              ? 'bg-brand-50 text-brand-700 hover:bg-brand-100 border border-brand-300'
                              : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-300'
                          }`}
                          title="Manual Admin Account Suspension Control"
                        >
                          {isBlocked ? 'Unblock Access' : 'Block Access'}
                        </button>

                        {/* WhatsApp Shortcut */}
                        <a
                          href={`https://wa.me/${phone.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 text-slate-500 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors"
                          title="Open WhatsApp Chat"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: ADD RESIDENT FORM */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="p-5 bg-navy text-white flex items-center justify-between">
              <h3 className="font-bold text-base flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-brand-400" /> Add New Resident Record
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Building / Block</label>
                  <select
                    value={formData.building}
                    onChange={(e) => setFormData({ ...formData, building: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 bg-white"
                  >
                    <option value="Block A">Block A</option>
                    <option value="Block B">Block B</option>
                    <option value="Block C">Block C</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Unit Number</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 101"
                    value={formData.unit_number}
                    onChange={(e) => setFormData({ ...formData, unit_number: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Muhammad Ahmed"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">WhatsApp Phone (+92...)</label>
                  <input
                    type="text"
                    required
                    placeholder="+923001234567"
                    value={formData.phone_number}
                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono bg-white text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">CNIC (Optional)</label>
                  <input
                    type="text"
                    placeholder="42101-1234567-1"
                    value={formData.cnic}
                    onChange={(e) => setFormData({ ...formData, cnic: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono bg-white text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Occupancy Role</label>
                  <div className="flex items-center gap-4 pt-1">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="role"
                        checked={formData.is_owner}
                        onChange={() => setFormData({ ...formData, is_owner: true, is_tenant: false })}
                      />
                      <span>Owner</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="role"
                        checked={formData.is_tenant}
                        onChange={() => setFormData({ ...formData, is_owner: false, is_tenant: true })}
                      />
                      <span>Tenant</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Vehicle Plate (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. KHI-1234"
                    value={formData.vehicle_plate}
                    onChange={(e) => setFormData({ ...formData, vehicle_plate: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono bg-white text-slate-800"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-lg shadow"
                >
                  Save Resident
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: BULK EXCEL / CSV ROSTER IMPORT */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="p-5 bg-navy text-white flex items-center justify-between">
              <h3 className="font-bold text-base flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-brand-400" /> Bulk Import Resident Roster
              </h3>
              <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleImportSubmit} className="p-5 space-y-4 text-xs">
              <div className="p-4 bg-slate-50 border border-dashed border-slate-300 rounded-lg text-center space-y-2">
                <UploadCloud className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="font-bold text-slate-700">Select `.csv` or `.xlsx` File</p>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  required
                  onChange={(e) => setImportFile(e.target.files[0])}
                  className="w-full text-xs text-slate-500 cursor-pointer"
                />
              </div>

              <div className="p-3 bg-blue-50 text-blue-800 rounded-lg text-[11px] space-y-1">
                <p className="font-bold">Required File Columns:</p>
                <p className="font-mono text-[10px]">building, unit_number, name, phone_number, cnic, is_owner, is_tenant</p>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-lg shadow"
                >
                  Upload & Import
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: BROADCAST WHATSAPP NOTIFICATION */}
      {showNotificationModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 my-8">
            {/* Header */}
            <div className="p-5 bg-navy text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-brand-500/20 text-brand-400 border border-brand-500/30 flex items-center justify-center shadow-xs">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Broadcast WhatsApp Notification</h3>
                  <p className="text-xs text-slate-300">
                    Send official announcements or maintenance notices directly to residents' WhatsApp
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowNotificationModal(false);
                  setBroadcastResult(null);
                }}
                className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Broadcast Form */}
            <form onSubmit={handleSendBroadcast} className="p-6 space-y-5 text-xs">
              {/* Delivery Result Banner if exists */}
              {broadcastResult && (
                <div
                  className={`p-3.5 rounded-xl border flex items-start gap-2.5 ${
                    broadcastResult.status === 'error'
                      ? 'bg-red-50 text-red-900 border-red-200'
                      : 'bg-emerald-50 text-emerald-900 border-emerald-200'
                  }`}
                >
                  {broadcastResult.status === 'error' ? (
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-xs">
                      {broadcastResult.status === 'error' ? 'Broadcast Delivery Error' : 'Broadcast Dispatched Successfully!'}
                    </p>
                    <p className="text-[11px] mt-0.5 opacity-90">{broadcastResult.message}</p>
                    {broadcastResult.sent_count !== undefined && (
                      <div className="flex items-center gap-2.5 mt-2 text-[10px] font-mono">
                        <span className="bg-white/80 px-2 py-0.5 rounded border">
                          Target: <strong>{broadcastResult.targets_count}</strong>
                        </span>
                        <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200">
                          Delivered: <strong>{broadcastResult.sent_count}</strong>
                        </span>
                        {broadcastResult.failed_count > 0 && (
                          <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded border border-red-200">
                            Failed: <strong>{broadcastResult.failed_count}</strong>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Target Audience Scope Selector */}
              <div className="space-y-2">
                <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                  Target Audience Scope
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNotificationForm({ ...notificationForm, scope: 'all' })}
                    className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                      notificationForm.scope === 'all'
                        ? 'border-brand-500 bg-brand-500/5 text-navy shadow-xs ring-1 ring-brand-500'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className="w-4 h-4 rounded-full border border-slate-300 flex items-center justify-center mt-0.5 shrink-0">
                      {notificationForm.scope === 'all' && (
                        <div className="w-2 h-2 rounded-full bg-brand-500" />
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-xs flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-brand-600" />
                        Whole Society
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        All buildings & residential units
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNotificationForm({ ...notificationForm, scope: 'building' })}
                    className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                      notificationForm.scope === 'building'
                        ? 'border-brand-500 bg-brand-500/5 text-navy shadow-xs ring-1 ring-brand-500'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className="w-4 h-4 rounded-full border border-slate-300 flex items-center justify-center mt-0.5 shrink-0">
                      {notificationForm.scope === 'building' && (
                        <div className="w-2 h-2 rounded-full bg-brand-500" />
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-xs flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5 text-brand-600" />
                        Single Building / Block
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Target a specific block only
                      </p>
                    </div>
                  </button>
                </div>

                {/* Single Building Dropdown (if scope === 'building') */}
                {notificationForm.scope === 'building' && (
                  <div className="pt-2 flex items-center gap-2">
                    <span className="text-slate-600 font-semibold text-xs">Select Building:</span>
                    <select
                      value={notificationForm.building}
                      onChange={(e) => setNotificationForm({ ...notificationForm, building: e.target.value })}
                      className="p-2 border border-slate-300 rounded-lg text-xs bg-white text-navy font-semibold focus:outline-brand-500"
                    >
                      {availableBuildings.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Recipient Count Indicator */}
                <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-500">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>
                    Will be dispatched to <strong className="text-navy">{targetResidentsCount} verified resident{targetResidentsCount === 1 ? '' : 's'}</strong> via WhatsApp Cloud API.
                  </span>
                </div>
              </div>

              {/* Preset Category Quick-Pills */}
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1.5">
                  Quick Preset Templates
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {NOTIFICATION_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() =>
                        setNotificationForm({
                          ...notificationForm,
                          category: preset.category,
                          title: preset.defaultTitle,
                          message: preset.defaultMessage,
                        })
                      }
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-medium transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title Input */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Notification Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Scheduled Water Tank Maintenance"
                  value={notificationForm.title}
                  onChange={(e) => setNotificationForm({ ...notificationForm, title: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-800 focus:outline-brand-500"
                  maxLength={150}
                />
              </div>

              {/* Message Textarea */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-700">
                    Message Body <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {notificationForm.message.length} / 2500 chars
                  </span>
                </div>
                <textarea
                  rows={4}
                  required
                  placeholder="Write the announcement or notice here. It will be sent directly to each resident's WhatsApp..."
                  value={notificationForm.message}
                  onChange={(e) => setNotificationForm({ ...notificationForm, message: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-800 focus:outline-brand-500 leading-relaxed font-sans"
                  maxLength={2500}
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Formatting tips: Use <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600">*text*</code> for bold, <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600">_text_</code> for italic. WhatsApp does not render HTML or hashtags.
                </p>
              </div>

              {/* WhatsApp Live Bubble Preview */}
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-2">
                  Live WhatsApp Chat Preview
                </label>
                <div className="bg-[#efeae2] p-4 rounded-xl border border-slate-200/80 shadow-inner">
                  {/* WhatsApp Message Bubble */}
                  <div className="bg-[#d9fdd3] text-slate-800 p-3.5 rounded-xl rounded-tl-none max-w-md shadow-xs text-xs space-y-2 border border-[#c3f4bc]">
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <span>📢</span>
                      <span>SOCIETY NOTICE: {notificationForm.title.trim().toUpperCase() || 'ANNOUNCEMENT TITLE'}</span>
                    </div>

                    <p className="text-[11px] text-slate-700">
                      Hello <strong>Muhammad Ahmed</strong> ({notificationForm.scope === 'building' ? notificationForm.building : 'Block A'} - Unit 101),
                    </p>

                    <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
                      {notificationForm.message.trim() || 'Your broadcast announcement message will appear here...'}
                    </p>

                    <div className="pt-1.5 border-t border-emerald-200/60 text-[10px] text-slate-500 italic flex items-center justify-between">
                      <span>Official notice sent by Society Office via Hamsayaa</span>
                      <span className="text-[9px] not-italic text-slate-400 flex items-center gap-1 font-mono">
                        12:30 PM <span className="text-brand-600 font-bold">✓✓</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                <div className="text-[11px] text-slate-500">
                  Target: <strong className="text-navy">{notificationForm.scope === 'all' ? 'Whole Society' : notificationForm.building}</strong> ({targetResidentsCount} units)
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowNotificationModal(false);
                      setBroadcastResult(null);
                    }}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSendingNotification || !notificationForm.title.trim() || !notificationForm.message.trim() || targetResidentsCount === 0}
                    className="px-5 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors text-xs"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${isSendingNotification ? 'animate-spin' : ''}`} />
                    <span>
                      {isSendingNotification
                        ? 'Broadcasting to WhatsApp...'
                        : `Broadcast via WhatsApp (${targetResidentsCount})`}
                    </span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
