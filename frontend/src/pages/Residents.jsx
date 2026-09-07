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
  AlertTriangle,
  Home,
  CheckCheck,
  Trash2,
  Pencil,
  FileText,
  ExternalLink
} from 'lucide-react';
import { mockBuildings, mockResidents } from '../services/mockData';
import {
  fetchResidents,
  createResidentApi,
  updateResidentApi,
  uploadResidentDocumentApi,
  toggleBlockResidentApi,
  deleteResidentApi,
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
  const [showEditModal, setShowEditModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [isSendingNotification, setIsSendingNotification] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState(null);
  const [showPreview, setShowPreview] = useState(true);

  // Edit Resident State
  const [editingResident, setEditingResident] = useState(null);
  const [editFormData, setEditFormData] = useState({
    building: 'Block A',
    unit_number: '',
    name: '',
    phone_number: '',
    cnic: '',
    is_owner: true,
    is_tenant: false,
    vehicle_plate: '',
    document_url: '',
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState('');

  // Document Upload State
  const [addDocFile, setAddDocFile] = useState(null);
  const [editDocFile, setEditDocFile] = useState(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [isSavingResident, setIsSavingResident] = useState(false);
  const [addResidentError, setAddResidentError] = useState('');

  // Delete Resident State
  const [deleteConfirmResident, setDeleteConfirmResident] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Broadcast Notification Form State (1 message per apartment)
  const [notificationForm, setNotificationForm] = useState({
    scope: 'all', // 'all', 'building', or 'apartment'
    building: 'Block A',
    unit_number: '',
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

  // Handle Delete Resident
  const handleDeleteResident = async () => {
    if (!deleteConfirmResident) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      const res = await deleteResidentApi(deleteConfirmResident.id);
      if (res && res.status === 'error') {
        setDeleteError(res.message || 'Failed to delete resident');
        setIsDeleting(false);
        return;
      }
      setResidents((prev) => prev.filter((r) => r.id !== deleteConfirmResident.id));
      setDeleteConfirmResident(null);
      setIsDeleting(false);
    } catch (err) {
      console.error('Error deleting resident:', err);
      setDeleteError('An error occurred while deleting resident');
      setIsDeleting(false);
    }
  };

  // Handle Create Resident Submit
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setAddResidentError('');
    if (!formData.unit_number || !formData.name || !formData.phone_number || !formData.cnic) {
      setAddResidentError('Please fill in all compulsory fields including CNIC.');
      return;
    }

    let cleanPhone = formData.phone_number.trim ? formData.phone_number.trim() : formData.phone_number;
    if (!cleanPhone.startsWith('+')) cleanPhone = '+' + cleanPhone;

    setIsSavingResident(true);

    let docUrl = null;
    if (addDocFile) {
      setIsUploadingDoc(true);
      const uploadRes = await uploadResidentDocumentApi(addDocFile);
      setIsUploadingDoc(false);
      if (uploadRes && uploadRes.document_url) {
        docUrl = uploadRes.document_url;
      }
    }

    const apiRes = await createResidentApi({
      ...formData,
      cnic: formData.cnic.trim(),
      phone_number: cleanPhone,
      document_url: docUrl,
    });

    if (apiRes && apiRes.status === 'error') {
      setAddResidentError(apiRes.message || 'Failed to save resident to database.');
      setIsSavingResident(false);
      return;
    }

    const createdData = (apiRes && apiRes.data) ? apiRes.data : {};
    const newResident = {
      id: createdData.id || `r-${Date.now()}`,
      building: createdData.building || formData.building,
      unitNumber: createdData.unit_number || formData.unit_number,
      unit_number: createdData.unit_number || formData.unit_number,
      name: createdData.name || formData.name,
      phoneNumber: createdData.phone_number || cleanPhone,
      phone_number: createdData.phone_number || cleanPhone,
      cnic: createdData.cnic || formData.cnic.trim(),
      isOwner: createdData.is_owner ?? formData.is_owner,
      is_owner: createdData.is_owner ?? formData.is_owner,
      isTenant: createdData.is_tenant ?? formData.is_tenant,
      is_tenant: createdData.is_tenant ?? formData.is_tenant,
      isBlocked: false,
      is_blocked: false,
      document_url: createdData.document_url || docUrl,
      documentUrl: createdData.document_url || docUrl,
      registeredVehicles: formData.vehicle_plate ? [formData.vehicle_plate] : [],
    };

    setResidents((prev) => [newResident, ...prev]);
    setShowAddModal(false);
    setAddDocFile(null);
    setIsSavingResident(false);
    setAddResidentError('');

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

  // Handle Open Edit Modal
  const handleOpenEdit = (resident) => {
    setEditingResident(resident);
    setUpdateError('');
    setEditDocFile(null);
    const vehicles = resident.registeredVehicles || resident.registered_vehicles || [];
    const firstPlate = Array.isArray(vehicles) && vehicles.length > 0
      ? (typeof vehicles[0] === 'string' ? vehicles[0] : (vehicles[0].plate_number || ''))
      : '';

    setEditFormData({
      building: resident.building || 'Block A',
      unit_number: resident.unitNumber || resident.unit_number || '',
      name: resident.name || '',
      phone_number: resident.phoneNumber || resident.phone_number || '',
      cnic: resident.cnic || '',
      is_owner: resident.isOwner !== undefined ? resident.isOwner : (resident.is_owner ?? true),
      is_tenant: resident.isTenant !== undefined ? resident.isTenant : (resident.is_tenant ?? false),
      vehicle_plate: firstPlate,
      document_url: resident.documentUrl || resident.document_url || '',
    });
    setShowEditModal(true);
  };

  // Handle Edit Resident Submit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingResident) return;
    if (!editFormData.unit_number || !editFormData.name || !editFormData.phone_number || !editFormData.cnic) {
      setUpdateError('Name, Unit Number, WhatsApp Phone, and CNIC are all compulsory.');
      return;
    }

    setIsUpdating(true);
    setUpdateError('');

    let cleanPhone = editFormData.phone_number.trim ? editFormData.phone_number.trim() : editFormData.phone_number;
    if (!cleanPhone.startsWith('+')) cleanPhone = '+' + cleanPhone;

    let finalDocUrl = editFormData.document_url;
    if (editDocFile) {
      setIsUploadingDoc(true);
      const uploadRes = await uploadResidentDocumentApi(editDocFile);
      setIsUploadingDoc(false);
      if (uploadRes && uploadRes.document_url) {
        finalDocUrl = uploadRes.document_url;
      }
    }

    const payload = {
      building: editFormData.building,
      unit_number: editFormData.unit_number,
      name: editFormData.name,
      phone_number: cleanPhone,
      cnic: editFormData.cnic.trim(),
      is_owner: editFormData.is_owner,
      is_tenant: editFormData.is_tenant,
      vehicle_plate: editFormData.vehicle_plate,
      document_url: finalDocUrl,
    };

    const res = await updateResidentApi(editingResident.id, payload);
    if (res && res.status === 'error') {
      setUpdateError(res.message || 'Failed to update resident');
      setIsUpdating(false);
      return;
    }

    setResidents((prev) =>
      prev.map((r) =>
        r.id === editingResident.id
          ? {
              ...r,
              ...payload,
              unitNumber: payload.unit_number,
              phoneNumber: payload.phone_number,
              isOwner: payload.is_owner,
              isTenant: payload.is_tenant,
              document_url: finalDocUrl,
              documentUrl: finalDocUrl,
              registeredVehicles: payload.vehicle_plate ? [payload.vehicle_plate] : (r.registeredVehicles || []),
            }
          : r
      )
    );

    setIsUpdating(false);
    setShowEditModal(false);
    setEditingResident(null);
    setEditDocFile(null);
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

  // Deduplicate residents into unique apartments (keyed by building + unit_number)
  // Prioritize owner first, then tenant as primary contact for the apartment (1 msg per household)
  const uniqueApartmentsMap = new Map();
  const sortedResidentsForDedup = [...residents]
    .filter((r) => r.phoneNumber || r.phone_number)
    .sort((a, b) => {
      const aOwner = a.isOwner ?? a.is_owner ?? false;
      const bOwner = b.isOwner ?? b.is_owner ?? false;
      const aTenant = a.isTenant ?? a.is_tenant ?? false;
      const bTenant = b.isTenant ?? b.is_tenant ?? false;
      if (aOwner !== bOwner) return aOwner ? -1 : 1;
      if (aTenant !== bTenant) return aTenant ? -1 : 1;
      return 0;
    });

  sortedResidentsForDedup.forEach((r) => {
    const bld = r.building || 'General';
    const unit = String(r.unitNumber || r.unit_number || '').trim();
    if (!unit) return;
    const key = `${bld.toLowerCase()}::${unit.toLowerCase()}`;
    if (!uniqueApartmentsMap.has(key)) {
      uniqueApartmentsMap.set(key, {
        ...r,
        building: bld,
        unitNumber: unit,
        displayName: r.name || 'Resident',
        phone: r.phoneNumber || r.phone_number,
      });
    }
  });

  const allApartments = Array.from(uniqueApartmentsMap.values());
  const currentBuildingApartments = allApartments.filter(
    (a) => a.building === notificationForm.building
  );

  // Target apartments based on selected scope
  let targetApartments = [];
  if (notificationForm.scope === 'all') {
    targetApartments = allApartments;
  } else if (notificationForm.scope === 'building') {
    targetApartments = currentBuildingApartments;
  } else if (notificationForm.scope === 'apartment') {
    targetApartments = currentBuildingApartments.filter(
      (a) => a.unitNumber.toLowerCase() === (notificationForm.unit_number || '').trim().toLowerCase()
    );
  }
  const targetApartmentsCount = targetApartments.length;

  // Selected apartment info for live preview
  const selectedApt = notificationForm.scope === 'apartment'
    ? currentBuildingApartments.find((a) => a.unitNumber.toLowerCase() === (notificationForm.unit_number || '').trim().toLowerCase())
    : null;

  const previewResidentName = selectedApt ? selectedApt.displayName : 'Resident';
  const previewLocation = notificationForm.scope === 'apartment'
    ? `${notificationForm.building} - Unit ${notificationForm.unit_number || '101'}`
    : notificationForm.scope === 'building'
    ? `${notificationForm.building} - Unit 101`
    : 'Block A - Unit 101';

  // Handle Dispatch Broadcast (1 message per apartment)
  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    if (!notificationForm.title.trim() || !notificationForm.message.trim()) return;

    setIsSendingNotification(true);
    setBroadcastResult(null);

    const targetBuilding = notificationForm.scope === 'all' ? 'All' : notificationForm.building;
    const targetUnit = notificationForm.scope === 'apartment' ? notificationForm.unit_number : undefined;

    const res = await broadcastResidentNotificationApi({
      title: notificationForm.title.trim(),
      message: notificationForm.message.trim(),
      building: targetBuilding,
      unit_number: targetUnit,
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
              if (!notificationForm.unit_number && currentBuildingApartments.length > 0) {
                setNotificationForm((prev) => ({ ...prev, unit_number: currentBuildingApartments[0].unitNumber }));
              }
              setShowNotificationModal(true);
            }}
            className="px-3.5 py-2 bg-navy hover:bg-navy/90 text-white font-semibold text-xs rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
            title="Broadcast WhatsApp notification to residents (society-wide, per building, or single apartment)"
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
            onClick={() => {
              setAddResidentError('');
              setShowAddModal(true);
            }}
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
                <th className="px-4 py-3">Documents</th>
                <th className="px-4 py-3">Status</th>
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
                const docUrl = r.documentUrl || r.document_url;

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
                              {typeof v === 'object' ? `${v.vehicle_plate || v.plate_number} (${v.vehicle_type || 'Car'})` : v}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[10px] font-italic">No vehicles</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {docUrl ? (
                        <a
                          href={docUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[11px] font-semibold hover:bg-emerald-100 transition-colors"
                          title="View attached resident document (PDF/Image)"
                        >
                          <FileText className="w-3 h-3 text-emerald-600" />
                          <span>View Doc</span>
                          <ExternalLink className="w-2.5 h-2.5 text-emerald-500" />
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(r)}
                          className="inline-flex items-center gap-1 text-slate-400 hover:text-brand-600 text-[11px] hover:underline"
                          title="Click to upload document"
                        >
                          <span>+ Upload</span>
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="status-pill status-pill-paid flex items-center gap-1 w-fit">
                        <CheckCircle className="w-3 h-3" /> ACTIVE
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Edit Resident Details */}
                        <button
                          onClick={() => handleOpenEdit(r)}
                          className="p-1.5 text-slate-500 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors"
                          title="Edit Resident Details"
                        >
                          <Pencil className="w-4 h-4" />
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

                        {/* Delete Resident Button */}
                        <button
                          onClick={() => {
                            setDeleteError('');
                            setDeleteConfirmResident(r);
                          }}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete Resident Record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 my-auto">
            <div className="p-4 sm:p-5 bg-navy text-white flex items-center justify-between shrink-0">
              <h3 className="font-bold text-base flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-brand-400" /> Add New Resident Record
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-4 sm:p-5 space-y-4 text-xs overflow-y-auto flex-1">
                {addResidentError && (
                  <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{addResidentError}</span>
                  </div>
                )}

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
                    <label className="block font-bold text-slate-700 mb-1">Apartment / Unit #</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 104"
                      value={formData.unit_number}
                      onChange={(e) => setFormData({ ...formData, unit_number: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white text-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Resident Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Tariq Mahmood"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white text-slate-800"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      WhatsApp Phone # <span className="text-red-500">*</span>
                    </label>
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
                    <label className="block font-bold text-slate-700 mb-1">
                      CNIC <span className="text-red-500">* (Compulsory)</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="42101-1234567-1"
                      value={formData.cnic}
                      onChange={(e) => setFormData({ ...formData, cnic: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono bg-white text-slate-800"
                    />
                  </div>
                </div>

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
                      <span className="font-semibold text-slate-700">Owner</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="role"
                        checked={formData.is_tenant}
                        onChange={() => setFormData({ ...formData, is_owner: false, is_tenant: true })}
                      />
                      <span className="font-semibold text-slate-700">Tenant</span>
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

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Verification Document (PDF / Image) <span className="text-slate-400 font-normal text-[10px]">— Optional, can be uploaded anytime</span>
                  </label>
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    onChange={(e) => setAddDocFile(e.target.files[0])}
                    className="w-full text-xs text-slate-500 file:mr-2.5 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 cursor-pointer"
                  />
                  {addDocFile && (
                    <p className="mt-1 text-[11px] text-brand-700 font-semibold flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5" /> Selected: {addDocFile.name} ({(addDocFile.size / 1024).toFixed(0)} KB)
                    </p>
                  )}
                </div>
              </div>

              <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingResident || isUploadingDoc}
                  className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-semibold rounded-lg shadow-sm text-xs transition-colors"
                >
                  {(isSavingResident || isUploadingDoc) && <RotateCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isUploadingDoc ? 'Uploading Doc...' : isSavingResident ? 'Saving...' : 'Save Resident'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT RESIDENT FORM */}
      {showEditModal && editingResident && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 my-auto animate-fade-in">
            {/* Header */}
            <div className="p-4 sm:p-5 bg-navy text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-brand-500/20 text-brand-400 border border-brand-500/30 flex items-center justify-center">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Edit Resident Details</h3>
                  <p className="text-[11px] text-slate-300">
                    Update profile, tenancy details, and verification documents
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowEditModal(false);
                  setEditingResident(null);
                }}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-4 sm:p-5 space-y-4 text-xs overflow-y-auto flex-1">
                {updateError && (
                  <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{updateError}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Building / Block</label>
                    <select
                      value={editFormData.building}
                      onChange={(e) => setEditFormData({ ...editFormData, building: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 bg-white"
                    >
                      <option value="Block A">Block A</option>
                      <option value="Block B">Block B</option>
                      <option value="Block C">Block C</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Apartment / Unit # <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 104"
                      value={editFormData.unit_number}
                      onChange={(e) => setEditFormData({ ...editFormData, unit_number: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white text-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Resident Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Tariq Mahmood"
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white text-slate-800"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      WhatsApp Phone # <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="+923001234567"
                      value={editFormData.phone_number}
                      onChange={(e) => setEditFormData({ ...editFormData, phone_number: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono bg-white text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      CNIC <span className="text-red-500">* (Compulsory)</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="42101-1234567-1"
                      value={editFormData.cnic}
                      onChange={(e) => setEditFormData({ ...editFormData, cnic: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono bg-white text-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Occupancy Role</label>
                  <div className="flex items-center gap-4 pt-1">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="edit_role"
                        checked={editFormData.is_owner}
                        onChange={() => setEditFormData({ ...editFormData, is_owner: true, is_tenant: false })}
                      />
                      <span className="font-semibold text-slate-700">Owner</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="edit_role"
                        checked={editFormData.is_tenant}
                        onChange={() => setEditFormData({ ...editFormData, is_owner: false, is_tenant: true })}
                      />
                      <span className="font-semibold text-slate-700">Tenant</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Vehicle Plate (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. KHI-1234"
                    value={editFormData.vehicle_plate}
                    onChange={(e) => setEditFormData({ ...editFormData, vehicle_plate: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono bg-white text-slate-800"
                  />
                </div>

                {/* Document Upload Section (Optional, Anytime) */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-700">
                      Resident Verification Document (PDF / Image)
                    </label>
                    <span className="text-[10px] text-slate-400 font-normal">Optional</span>
                  </div>

                  {editFormData.document_url ? (
                    <div className="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-200 rounded-md">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-emerald-700 shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-emerald-900">Document Uploaded</p>
                          <p className="text-[10px] text-emerald-700">Verification file is linked to this resident</p>
                        </div>
                      </div>
                      <a
                        href={editFormData.document_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-emerald-300 rounded text-[11px] font-bold text-emerald-800 hover:bg-emerald-100 transition-colors shadow-2xs"
                      >
                        <span>View PDF / Doc</span>
                        <ExternalLink className="w-3 h-3 text-emerald-600" />
                      </a>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500">
                      No document currently attached. You can upload tenancy contracts, CNIC copies, or verification forms anytime.
                    </p>
                  )}

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      {editFormData.document_url ? 'Replace Document (PDF / Image):' : 'Upload New Document (PDF / Image):'}
                    </label>
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      onChange={(e) => setEditDocFile(e.target.files[0])}
                      className="w-full text-xs text-slate-500 file:mr-2.5 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 cursor-pointer"
                    />
                    {editDocFile && (
                      <p className="mt-1 text-[11px] text-brand-700 font-semibold flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5" /> Selected: {editDocFile.name} ({(editDocFile.size / 1024).toFixed(0)} KB)
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer with Delete Resident on the Left */}
              <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
                {/* Delete button inside Edit modal */}
                <button
                  type="button"
                  onClick={() => {
                    setDeleteError('');
                    setDeleteConfirmResident(editingResident);
                    setShowEditModal(false);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-bold transition-colors shadow-xs"
                  title="Delete this resident record"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-600" />
                  <span>Delete Resident</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingResident(null);
                    }}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg text-xs transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdating || isUploadingDoc}
                    className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-semibold rounded-lg shadow-sm text-xs transition-colors"
                  >
                    {(isUpdating || isUploadingDoc) && <RotateCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>{isUploadingDoc ? 'Uploading...' : isUpdating ? 'Saving...' : 'Save Changes'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: BULK EXCEL / CSV ROSTER IMPORT */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 my-auto">
            <div className="p-4 sm:p-5 bg-navy text-white flex items-center justify-between shrink-0">
              <h3 className="font-bold text-base flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-brand-400" /> Bulk Import Resident Roster
              </h3>
              <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleImportSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-4 sm:p-5 space-y-4 text-xs overflow-y-auto flex-1">
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
              </div>

              <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-lg shadow-sm text-xs"
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
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden my-auto animate-fade-in">
            {/* Header (Fixed at top) */}
            <div className="p-4 sm:p-4.5 bg-navy text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-brand-500/20 text-brand-400 border border-brand-500/30 flex items-center justify-center shadow-xs">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base">Broadcast WhatsApp Notification</h3>
                  <p className="text-[11px] text-slate-300">
                    Send official announcements or notices directly to residents' WhatsApp
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
            <form onSubmit={handleSendBroadcast} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-4 sm:p-5 space-y-4 text-xs overflow-y-auto flex-1">
                {/* Delivery Result Banner if exists */}
                {broadcastResult && (
                  <div
                    className={`p-3 rounded-xl border flex items-start gap-2.5 ${
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
                        <div className="flex items-center gap-2 mt-2 text-[10px] font-mono">
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
                  <div className="flex items-center justify-between">
                    <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                      Target Audience Scope
                    </label>
                    <span className="text-[10px] text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full font-semibold border border-brand-200/60 flex items-center gap-1">
                      <CheckCheck className="w-3 h-3 text-brand-600" />
                      1 Msg per Apartment
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {/* Scope 1: Whole Society */}
                    <button
                      type="button"
                      onClick={() => setNotificationForm((prev) => ({ ...prev, scope: 'all' }))}
                      className={`p-2.5 rounded-xl border text-left flex items-start gap-2 transition-all ${
                        notificationForm.scope === 'all'
                          ? 'border-brand-500 bg-brand-500/5 text-navy shadow-xs ring-1 ring-brand-500'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <div className="w-3.5 h-3.5 rounded-full border border-slate-300 flex items-center justify-center mt-0.5 shrink-0">
                        {notificationForm.scope === 'all' && (
                          <div className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-xs flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-brand-600" />
                          Whole Society
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          All society apartments
                        </p>
                      </div>
                    </button>

                    {/* Scope 2: Single Building */}
                    <button
                      type="button"
                      onClick={() => setNotificationForm((prev) => ({ ...prev, scope: 'building' }))}
                      className={`p-2.5 rounded-xl border text-left flex items-start gap-2 transition-all ${
                        notificationForm.scope === 'building'
                          ? 'border-brand-500 bg-brand-500/5 text-navy shadow-xs ring-1 ring-brand-500'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <div className="w-3.5 h-3.5 rounded-full border border-slate-300 flex items-center justify-center mt-0.5 shrink-0">
                        {notificationForm.scope === 'building' && (
                          <div className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-xs flex items-center gap-1">
                          <Building className="w-3.5 h-3.5 text-brand-600" />
                          Single Building
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          All units in 1 block
                        </p>
                      </div>
                    </button>

                    {/* Scope 3: Single Apartment */}
                    <button
                      type="button"
                      onClick={() => {
                        const bld = notificationForm.building || availableBuildings[0] || 'Block A';
                        const bldApts = allApartments.filter((a) => a.building === bld);
                        const firstUnit = bldApts.length > 0 ? bldApts[0].unitNumber : '';
                        setNotificationForm((prev) => ({
                          ...prev,
                          scope: 'apartment',
                          building: bld,
                          unit_number: prev.unit_number && bldApts.some((a) => a.unitNumber === prev.unit_number) ? prev.unit_number : firstUnit,
                        }));
                      }}
                      className={`p-2.5 rounded-xl border text-left flex items-start gap-2 transition-all ${
                        notificationForm.scope === 'apartment'
                          ? 'border-brand-500 bg-brand-500/5 text-navy shadow-xs ring-1 ring-brand-500'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <div className="w-3.5 h-3.5 rounded-full border border-slate-300 flex items-center justify-center mt-0.5 shrink-0">
                        {notificationForm.scope === 'apartment' && (
                          <div className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-xs flex items-center gap-1">
                          <Home className="w-3.5 h-3.5 text-brand-600" />
                          Single Apartment
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          1 specific household
                        </p>
                      </div>
                    </button>
                  </div>

                  {/* Single Building Dropdown */}
                  {notificationForm.scope === 'building' && (
                    <div className="pt-1 flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
                      <span className="text-slate-700 font-semibold text-xs flex items-center gap-1 shrink-0">
                        <Building className="w-3.5 h-3.5 text-brand-600" />
                        Select Building / Block:
                      </span>
                      <select
                        value={notificationForm.building}
                        onChange={(e) => setNotificationForm((prev) => ({ ...prev, building: e.target.value }))}
                        className="p-1 border border-slate-300 rounded-md text-xs bg-white text-navy font-semibold focus:outline-brand-500 w-full max-w-xs"
                      >
                        {availableBuildings.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Single Apartment Dropdowns */}
                  {notificationForm.scope === 'apartment' && (
                    <div className="pt-1 grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <div>
                        <label className="block text-slate-700 font-semibold text-[11px] mb-1 flex items-center gap-1">
                          <Building className="w-3.5 h-3.5 text-brand-600" />
                          1. Filter Building:
                        </label>
                        <select
                          value={notificationForm.building}
                          onChange={(e) => {
                            const newBld = e.target.value;
                            const bldApts = allApartments.filter((a) => a.building === newBld);
                            const firstUnit = bldApts.length > 0 ? bldApts[0].unitNumber : '';
                            setNotificationForm((prev) => ({
                              ...prev,
                              building: newBld,
                              unit_number: firstUnit,
                            }));
                          }}
                          className="w-full p-1.5 border border-slate-300 rounded-md text-xs bg-white text-navy font-semibold focus:outline-brand-500"
                        >
                          {availableBuildings.map((b) => (
                            <option key={b} value={b}>
                              {b}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-700 font-semibold text-[11px] mb-1 flex items-center gap-1">
                          <Home className="w-3.5 h-3.5 text-brand-600" />
                          2. Select Apartment / Unit:
                        </label>
                        <select
                          value={notificationForm.unit_number}
                          onChange={(e) => setNotificationForm((prev) => ({ ...prev, unit_number: e.target.value }))}
                          className="w-full p-1.5 border border-slate-300 rounded-md text-xs bg-white text-navy font-semibold focus:outline-brand-500"
                        >
                          {currentBuildingApartments.length === 0 ? (
                            <option value="">No registered apartments found in this block</option>
                          ) : (
                            currentBuildingApartments.map((apt) => (
                              <option key={apt.unitNumber} value={apt.unitNumber}>
                                Unit {apt.unitNumber} — {apt.displayName} ({apt.phone})
                              </option>
                            ))
                          )}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Recipient Count Indicator */}
                  <div className="flex items-center gap-2 pt-0.5 text-[11px] text-slate-500">
                    <span className={`w-2 h-2 rounded-full ${targetApartmentsCount > 0 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    <span>
                      Will be dispatched to <strong className="text-navy font-bold">{targetApartmentsCount} apartment{targetApartmentsCount === 1 ? '' : 's'}</strong> (strictly 1 WhatsApp message per household).
                    </span>
                  </div>
                </div>

                {/* Preset Category Quick-Pills */}
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                    Quick Preset Templates
                  </label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {NOTIFICATION_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() =>
                          setNotificationForm((prev) => ({
                            ...prev,
                            category: preset.category,
                            title: preset.defaultTitle,
                            message: preset.defaultMessage,
                          }))
                        }
                        className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[11px] font-medium transition-colors border border-slate-200/60"
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
                    onChange={(e) => setNotificationForm((prev) => ({ ...prev, title: e.target.value }))}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white text-slate-800 focus:outline-brand-500"
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
                    rows={3}
                    required
                    placeholder="Write the announcement or notice here. It will be sent directly to each resident's WhatsApp..."
                    value={notificationForm.message}
                    onChange={(e) => setNotificationForm((prev) => ({ ...prev, message: e.target.value }))}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white text-slate-800 focus:outline-brand-500 leading-relaxed font-sans"
                    maxLength={2500}
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Formatting tips: Use <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600">*text*</code> for bold, <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600">_text_</code> for italic. WhatsApp does not render HTML or hashtags.
                  </p>
                </div>

                {/* WhatsApp Live Bubble Preview */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-bold text-slate-700 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                      Live WhatsApp Chat Preview
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPreview((prev) => !prev)}
                      className="text-[10px] font-semibold text-brand-600 hover:text-brand-700 underline cursor-pointer"
                    >
                      {showPreview ? 'Hide Preview' : 'Show Preview'}
                    </button>
                  </div>
                  {showPreview && (
                    <div className="bg-[#efeae2] p-3 rounded-xl border border-slate-200/80 shadow-inner">
                      <div className="bg-[#d9fdd3] text-slate-800 p-3 rounded-xl rounded-tl-none max-w-md shadow-xs text-xs space-y-1.5 border border-[#c3f4bc]">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5 text-[11px]">
                          <span>📢</span>
                          <span>SOCIETY NOTICE: {notificationForm.title.trim().toUpperCase() || 'ANNOUNCEMENT TITLE'}</span>
                        </div>

                        <p className="text-[11px] text-slate-700">
                          Hello <strong>{previewResidentName}</strong> ({previewLocation}),
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
                  )}
                </div>
              </div>

              {/* Modal Actions (Fixed at bottom) */}
              <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
                <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${targetApartmentsCount > 0 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  <span>
                    Target: <strong className="text-navy font-semibold">
                      {notificationForm.scope === 'all'
                        ? 'Whole Society'
                        : notificationForm.scope === 'building'
                        ? notificationForm.building
                        : `${notificationForm.building} - Unit ${notificationForm.unit_number || 'All'}`}
                    </strong> ({targetApartmentsCount} apartment{targetApartmentsCount === 1 ? '' : 's'})
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setShowNotificationModal(false);
                      setBroadcastResult(null);
                    }}
                    className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-medium rounded-lg transition-colors text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSendingNotification || !notificationForm.title.trim() || !notificationForm.message.trim() || targetApartmentsCount === 0}
                    className="px-4.5 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors text-xs"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${isSendingNotification ? 'animate-spin' : ''}`} />
                    <span>
                      {isSendingNotification
                        ? 'Broadcasting to WhatsApp...'
                        : `Broadcast via WhatsApp (${targetApartmentsCount})`}
                    </span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DELETE CONFIRMATION */}
      {deleteConfirmResident && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4 border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-2">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-navy text-center">Delete Resident Record</h3>
            <p className="text-xs text-slate-600 text-center leading-relaxed">
              Are you sure you want to permanently delete{' '}
              <strong className="text-slate-800 font-semibold">{deleteConfirmResident.name}</strong> from{' '}
              <span className="font-semibold text-slate-800">{deleteConfirmResident.building || 'General'} - Unit {deleteConfirmResident.unitNumber || deleteConfirmResident.unit_number}</span>?
            </p>
            <div className="bg-amber-50 border border-amber-200/80 rounded-lg p-3 text-[11px] text-amber-800 space-y-1">
              <p className="font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" /> Cascade Cleanup:
              </p>
              <p className="leading-normal">
                This will permanently delete this resident and clean up all associated maintenance invoices, complaint tickets, and visitor passes. This action cannot be undone.
              </p>
            </div>

            {deleteError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2 text-center font-medium">
                {deleteError}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmResident(null);
                  setDeleteError('');
                }}
                disabled={isDeleting}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteResident}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white text-xs font-semibold rounded-lg shadow-sm hover:bg-red-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirm Delete</span>
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
