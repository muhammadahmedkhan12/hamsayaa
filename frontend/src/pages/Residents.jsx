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
  UserCheck
} from 'lucide-react';
import { mockBuildings } from '../services/mockData';
import { fetchResidents, createResidentApi, toggleBlockResidentApi, bulkImportResidentsApi } from '../services/api';

export default function Residents() {
  const [selectedBuilding, setSelectedBuilding] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [residents, setResidents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

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

  // Load Residents
  useEffect(() => {
    loadResidentsList(selectedBuilding);
  }, [selectedBuilding]);

  const loadResidentsList = async (bld) => {
    setLoading(true);
    const data = await fetchResidents(bld);
    setResidents(data);
    setLoading(false);
  };

  // Filtered residents by search query
  const filteredResidents = residents.filter((r) => {
    const q = searchQuery.toLowerCase();
    const unitStr = `${r.building || ''} ${r.unitNumber || r.unit_number || ''}`.toLowerCase();
    const nameStr = (r.name || '').toLowerCase();
    const phoneStr = (r.phoneNumber || r.phone_number || '').toLowerCase();
    return unitStr.includes(q) || nameStr.includes(q) || phoneStr.includes(q);
  });

  // Handle Manual Block Toggle
  const handleToggleBlock = async (residentId, currentStatus) => {
    const newStatus = !currentStatus;
    // Optimistic UI update
    setResidents((prev) =>
      prev.map((r) => (r.id === residentId ? { ...r, isBlocked: newStatus, is_blocked: newStatus } : r))
    );
    await toggleBlockResidentApi(residentId, newStatus);
  };

  // Handle Create Resident Submit
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!formData.unit_number || !formData.name || !formData.phone_number) return;

    const newResident = {
      id: `r-${Date.now()}`,
      building: formData.building,
      unitNumber: formData.unit_number,
      unit_number: formData.unit_number,
      name: formData.name,
      phoneNumber: formData.phone_number,
      phone_number: formData.phone_number,
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
    await createResidentApi(formData);
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

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy tracking-tight">Residents & Building Roster</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage unit occupancy, WhatsApp bot access, and manual payment blocks.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-white text-slate-700 font-medium text-sm rounded-lg border border-surface-border hover:bg-slate-50 transition-colors shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Bulk Excel Roster</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm rounded-lg shadow transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Resident</span>
          </button>
        </div>
      </div>

      {/* Building / Block Filter Tabs */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-2">
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
            <Users className="w-4 h-4 text-emerald-600" />
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
                const vehicles = r.registeredVehicles || [];

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
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
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
                              {v}
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
                              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-300'
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
                          className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
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
                <UserCheck className="w-5 h-5 text-emerald-400" /> Add New Resident Record
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
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs"
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
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs"
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
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">CNIC (Optional)</label>
                  <input
                    type="text"
                    placeholder="42101-1234567-1"
                    value={formData.cnic}
                    onChange={(e) => setFormData({ ...formData, cnic: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono"
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
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono"
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
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg shadow"
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
                <UploadCloud className="w-5 h-5 text-emerald-400" /> Bulk Import Resident Roster
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
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg shadow"
                >
                  Upload & Import
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
