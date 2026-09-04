import React, { useState, useEffect } from 'react';
import {
  Contact,
  ShieldCheck,
  Shield,
  Wrench,
  UserCheck,
  Plus,
  Search,
  Filter,
  Phone,
  Clock,
  Edit2,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { fetchEmployees, createEmployeeApi, updateEmployeeApi, deleteEmployeeApi } from '../services/api';

const PRESET_ROLES = [
  'Gate Security Guard',
  'Head Security Supervisor',
  'Resident Electrician',
  'Plumbing Specialist',
  'Building Supervisor',
  'Sanitation & Janitorial',
  'Gardener & Landscaper',
  'HVAC & Generator Tech'
];

const PRESET_SHIFTS = [
  'Morning (08:00 - 16:00)',
  'Evening (16:00 - 00:00)',
  'Night (00:00 - 08:00)',
  'Full-Time (09:00 - 18:00)',
  'On-Call / Standby'
];

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('All');
  const [selectedShiftFilter, setSelectedShiftFilter] = useState('All');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [deletingEmployee, setDeletingEmployee] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    role: 'Gate Security Guard',
    contact_info: '+92 3',
    shift: 'Morning (08:00 - 16:00)'
  });
  const [submitting, setSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');

  // Load Employees on Mount
  useEffect(() => {
    loadEmployeesData();
  }, []);

  const loadEmployeesData = async () => {
    setLoading(true);
    const data = await fetchEmployees();
    setEmployees(data || []);
    setLoading(false);
  };

  // Helper for Role Department Classification
  const getRoleCategory = (role = '') => {
    const r = role.toLowerCase();
    if (r.includes('guard') || r.includes('security')) return 'Security';
    if (r.includes('electric') || r.includes('plumb') || r.includes('tech') || r.includes('repair') || r.includes('hvac')) return 'Maintenance';
    if (r.includes('supervis') || r.includes('manager')) return 'Supervisor';
    if (r.includes('sanitation') || r.includes('clean') || r.includes('janitor') || r.includes('garden')) return 'Sanitation';
    return 'General';
  };

  // Metric Computations
  const totalCount = employees.length;
  const securityCount = employees.filter(e => getRoleCategory(e.role) === 'Security').length;
  const maintenanceCount = employees.filter(e => getRoleCategory(e.role) === 'Maintenance').length;
  const supervisorCount = employees.filter(e => getRoleCategory(e.role) === 'Supervisor').length;

  // Filtered List
  const filteredEmployees = employees.filter((emp) => {
    const q = searchQuery.toLowerCase();
    const matchesQuery =
      (emp.name || '').toLowerCase().includes(q) ||
      (emp.role || '').toLowerCase().includes(q) ||
      (emp.contact_info || '').toLowerCase().includes(q) ||
      (emp.shift || '').toLowerCase().includes(q);

    const category = getRoleCategory(emp.role);
    const matchesRole =
      selectedRoleFilter === 'All' ||
      category === selectedRoleFilter ||
      emp.role === selectedRoleFilter;

    const matchesShift =
      selectedShiftFilter === 'All' ||
      (emp.shift || '').toLowerCase().includes(selectedShiftFilter.toLowerCase());

    return matchesQuery && matchesRole && matchesShift;
  });

  // Handle Create Submit
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.role) return;
    setSubmitting(true);

    const payload = {
      name: formData.name.trim(),
      role: formData.role.trim(),
      contact_info: formData.contact_info.trim() || null,
      shift: formData.shift.trim() || 'Morning (08:00 - 16:00)'
    };

    const res = await createEmployeeApi(payload);
    if (res && res.employee) {
      setEmployees((prev) => [res.employee, ...prev]);
      setShowAddModal(false);
      setFormData({
        name: '',
        role: 'Gate Security Guard',
        contact_info: '+92 3',
        shift: 'Morning (08:00 - 16:00)'
      });
      setFeedbackMsg('Employee added successfully!');
      setTimeout(() => setFeedbackMsg(''), 4000);
    }
    setSubmitting(false);
  };

  // Handle Edit Submit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingEmployee) return;
    setSubmitting(true);

    const payload = {
      name: editingEmployee.name.trim(),
      role: editingEmployee.role.trim(),
      contact_info: editingEmployee.contact_info?.trim() || null,
      shift: editingEmployee.shift?.trim() || 'Morning (08:00 - 16:00)'
    };

    const res = await updateEmployeeApi(editingEmployee.id, payload);
    if (res && res.employee) {
      setEmployees((prev) =>
        prev.map((emp) => (emp.id === editingEmployee.id ? { ...emp, ...res.employee } : emp))
      );
      setEditingEmployee(null);
      setFeedbackMsg('Employee record updated successfully!');
      setTimeout(() => setFeedbackMsg(''), 4000);
    }
    setSubmitting(false);
  };

  // Handle Delete
  const handleDeleteConfirm = async () => {
    if (!deletingEmployee) return;
    const empId = deletingEmployee.id;
    await deleteEmployeeApi(empId);
    setEmployees((prev) => prev.filter((emp) => emp.id !== empId));
    setDeletingEmployee(null);
    setFeedbackMsg('Employee record removed from directory.');
    setTimeout(() => setFeedbackMsg(''), 4000);
  };

  // Helper for Category Colors
  const getBadgeStyle = (category) => {
    switch (category) {
      case 'Security':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Maintenance':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'Supervisor':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Sanitation':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
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
            <Contact className="w-6 h-6 text-brand-500" />
            Employee & Staff Directory
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Operational contact records for gate guards, technicians, and building staff.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadEmployeesData}
            className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-1.5 bg-navy text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-4 h-4" /> Add Staff Member
          </button>
        </div>
      </div>

      {/* Security Policy Notice Banner */}
      <div className="bg-gradient-to-r from-slate-50 to-blue-50/40 border border-slate-200 rounded-lg p-3.5 flex items-start gap-3 shadow-xs">
        <ShieldCheck className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-600 space-y-0.5">
          <p className="font-bold text-navy">Security Policy & Access Governance</p>
          <p>
            Employees recorded in this directory are non-login personnel (guards, technicians, cleaners). They have{' '}
            <span className="font-semibold text-slate-800">no login credentials, dashboard permissions, or WhatsApp bot interactions</span>.
            This directory is strictly a verified administrative contact registry for society operations.
          </p>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-surface-border shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-navy shrink-0">
            <Contact className="w-5 h-5 text-slate-700" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Total Staff Members</div>
            <div className="text-xl font-bold text-navy">{totalCount}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-surface-border shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Gate & Security</div>
            <div className="text-xl font-bold text-blue-700">{securityCount}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-surface-border shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Maintenance Techs</div>
            <div className="text-xl font-bold text-amber-700">{maintenanceCount}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-surface-border shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Supervisors</div>
            <div className="text-xl font-bold text-purple-700">{supervisorCount}</div>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-1 overflow-x-auto">
          {['All', 'Security', 'Maintenance', 'Supervisor', 'Sanitation'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedRoleFilter(cat)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                selectedRoleFilter === cat
                  ? 'bg-navy text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat === 'All' ? 'All Departments' : cat}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* Shift Filter Dropdown */}
          <select
            value={selectedShiftFilter}
            onChange={(e) => setSelectedShiftFilter(e.target.value)}
            className="bg-white border border-slate-200 text-xs font-medium text-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none shadow-xs"
          >
            <option value="All">All Shifts</option>
            <option value="Morning">Morning Shift</option>
            <option value="Evening">Evening Shift</option>
            <option value="Night">Night Shift</option>
            <option value="Full-Time">Full-Time</option>
          </select>

          {/* Search Input */}
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 w-60 shadow-xs">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search staff, role, phone..."
              className="bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none w-full"
            />
          </div>
        </div>
      </div>

      {/* Employees Directory List */}
      <div className="bg-white rounded-lg border border-surface-border shadow-sm overflow-hidden">
        <div className="p-4 border-b border-surface-border bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Contact className="w-4 h-4 text-brand-500" />
            <h2 className="font-bold text-navy text-sm">Active Staff Records ({filteredEmployees.length})</h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">Read/Write Administrative Directory</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading employee records...</div>
        ) : filteredEmployees.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <p className="text-sm font-semibold">No staff records match your criteria.</p>
            <p className="text-xs text-slate-400">Try adjusting your department filter or click "Add Staff Member" to add a new record.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredEmployees.map((emp) => {
              const category = getRoleCategory(emp.role);
              const badgeCls = getBadgeStyle(category);
              const initials = (emp.name || 'S')
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase();

              return (
                <div
                  key={emp.id}
                  className="p-4 hover:bg-slate-50/80 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3 flex-1">
                    {/* Avatar Initials */}
                    <div className="w-10 h-10 rounded-full bg-navy text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                      {initials}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-800 text-sm">{emp.name}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${badgeCls}`}>
                          {emp.role}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                        {emp.shift && (
                          <span className="flex items-center gap-1 font-mono text-[11px] text-slate-600">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {emp.shift}
                          </span>
                        )}

                        {emp.contact_info ? (
                          <a
                            href={`tel:${emp.contact_info.replace(/\s+/g, '')}`}
                            className="flex items-center gap-1 font-mono text-[11px] text-brand-600 hover:text-brand-800 hover:underline"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            {emp.contact_info}
                          </a>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">No phone recorded</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end md:self-center">
                    {emp.contact_info && (
                      <a
                        href={`tel:${emp.contact_info.replace(/\s+/g, '')}`}
                        className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors"
                        title="Call Phone"
                      >
                        <Phone className="w-4 h-4" />
                      </a>
                    )}
                    <button
                      onClick={() => setEditingEmployee(emp)}
                      className="p-1.5 text-slate-500 hover:text-navy hover:bg-slate-100 rounded transition-colors"
                      title="Edit Record"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeletingEmployee(emp)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                      title="Delete Record"
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

      {/* ADD EMPLOYEE MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-navy/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-surface-border">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-brand-500" />
                <h3 className="font-bold text-navy text-base">Add New Staff Member</h3>
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
                <label className="block text-xs font-bold text-slate-700 mb-1">Staff Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mohammad Aslam"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-brand-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Role / Job Title *</label>
                <div className="space-y-1.5">
                  <select
                    value={PRESET_ROLES.includes(formData.role) ? formData.role : 'Custom'}
                    onChange={(e) => {
                      if (e.target.value !== 'Custom') {
                        setFormData({ ...formData, role: e.target.value });
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-brand-500 focus:bg-white"
                  >
                    {PRESET_ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                    <option value="Custom">Custom Role...</option>
                  </select>

                  {!PRESET_ROLES.includes(formData.role) && (
                    <input
                      type="text"
                      placeholder="Enter custom role title"
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-brand-500 focus:bg-white"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Contact Phone Number</label>
                <input
                  type="text"
                  placeholder="+92 300 1234567"
                  value={formData.contact_info}
                  onChange={(e) => setFormData({ ...formData, contact_info: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 font-mono focus:outline-none focus:border-brand-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Shift Assignment</label>
                <select
                  value={formData.shift}
                  onChange={(e) => setFormData({ ...formData, shift: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-brand-500 focus:bg-white"
                >
                  {PRESET_SHIFTS.map((sh) => (
                    <option key={sh} value={sh}>{sh}</option>
                  ))}
                </select>
              </div>

              <p className="text-[11px] text-slate-400 italic">
                * Note: Employees do not receive WhatsApp bot or dashboard login access.
              </p>

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
                  className="px-4 py-2 bg-navy text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT EMPLOYEE MODAL */}
      {editingEmployee && (
        <div className="fixed inset-0 bg-navy/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-surface-border">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-brand-500" />
                <h3 className="font-bold text-navy text-base">Edit Staff Member</h3>
              </div>
              <button
                onClick={() => setEditingEmployee(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Staff Full Name *</label>
                <input
                  type="text"
                  required
                  value={editingEmployee.name || ''}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-brand-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Role / Job Title *</label>
                <input
                  type="text"
                  required
                  value={editingEmployee.role || ''}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, role: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-brand-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Contact Phone Number</label>
                <input
                  type="text"
                  value={editingEmployee.contact_info || ''}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, contact_info: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 font-mono focus:outline-none focus:border-brand-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Shift Assignment</label>
                <select
                  value={editingEmployee.shift || 'Morning (08:00 - 16:00)'}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, shift: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-brand-500 focus:bg-white"
                >
                  {PRESET_SHIFTS.map((sh) => (
                    <option key={sh} value={sh}>{sh}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingEmployee(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-navy text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Updating...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingEmployee && (
        <div className="fixed inset-0 bg-navy/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-2xl border border-surface-border space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-navy text-sm">Remove Employee Record</h3>
                <p className="text-xs text-slate-500">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600">
              Are you sure you want to remove <span className="font-bold text-slate-800">{deletingEmployee.name}</span> ({deletingEmployee.role}) from the staff directory?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setDeletingEmployee(null)}
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
