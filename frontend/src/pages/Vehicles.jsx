import React, { useState, useEffect } from 'react';
import {
  Car,
  Camera,
  Plus,
  FileSpreadsheet,
  Search,
  RefreshCw,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  X,
  UploadCloud,
  LogOut,
  Sparkles,
  UserCheck,
  UserX,
  ShieldCheck
} from 'lucide-react';
import {
  fetchVehicleLogs,
  createVehicleLogApi,
  simulateCameraEventApi,
  markVehicleExitApi,
  bulkImportVehiclesApi
} from '../services/api';

export default function Vehicles() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState('all');

  // Modals
  const [showManualModal, setShowManualModal] = useState(false);
  const [showCameraSimModal, setShowCameraSimModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  // Form States
  const [manualPlate, setManualPlate] = useState('');
  const [cameraPlate, setCameraPlate] = useState('KHI-1234');
  const [cameraId, setCameraId] = useState('Gate-1-Entrance');
  const [importFile, setImportFile] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');

  // Initial Load
  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    const data = await fetchVehicleLogs();
    setLogs(data || []);
    setLoading(false);
  };

  // Metrics
  const totalCount = logs.length;
  const insideCount = logs.filter(l => l.is_inside).length;
  const residentsInside = logs.filter(l => l.is_inside && l.is_registered).length;
  const overstayCount = logs.filter(l => l.is_inside && l.is_flagged_overstay).length;

  // Filtered Logs
  const filteredLogs = logs.filter((log) => {
    const q = searchQuery.toLowerCase();
    const plate = (log.vehicle_plate || '').toLowerCase();
    const resName = (log.resident_name || '').toLowerCase();
    const resUnit = (log.resident_unit || '').toLowerCase();
    const matchesQuery = plate.includes(q) || resName.includes(q) || resUnit.includes(q);

    let matchesTab = true;
    if (selectedTab === 'inside') matchesTab = log.is_inside;
    else if (selectedTab === 'overstay') matchesTab = log.is_inside && log.is_flagged_overstay;
    else if (selectedTab === 'residents') matchesTab = log.is_registered;
    else if (selectedTab === 'visitors') matchesTab = !log.is_registered;

    return matchesQuery && matchesTab;
  });

  // Handle Manual Log Submit
  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!manualPlate) return;
    setSubmitting(true);

    const cleanPlate = manualPlate.trim().toUpperCase();
    const res = await createVehicleLogApi({ vehicle_plate: cleanPlate, source: 'manual' });
    if (res && res.log) {
      setLogs((prev) => [res.log, ...prev]);
      setShowManualModal(false);
      setManualPlate('');
      setFeedbackMsg(`Vehicle ${cleanPlate} logged at entrance.`);
      setTimeout(() => setFeedbackMsg(''), 4000);
    }
    setSubmitting(false);
  };

  // Handle Camera Simulator Trigger
  const handleCameraSimulate = async (e) => {
    e.preventDefault();
    if (!cameraPlate) return;
    setSubmitting(true);

    const cleanPlate = cameraPlate.trim().toUpperCase();
    const res = await simulateCameraEventApi(cleanPlate, cameraId);
    if (res && res.log) {
      setLogs((prev) => [res.log, ...prev]);
      setShowCameraSimModal(false);
      setFeedbackMsg(`📷 ANPR Camera [${cameraId}] detected and logged ${cleanPlate}!`);
      setTimeout(() => setFeedbackMsg(''), 4000);
    }
    setSubmitting(false);
  };

  // Handle Mark Exit
  const handleMarkExit = async (logId, plate) => {
    await markVehicleExitApi(logId);
    setLogs((prev) =>
      prev.map((l) =>
        l.id === logId
          ? { ...l, exit_time: new Date().toISOString(), is_inside: false, is_flagged_overstay: false }
          : l
      )
    );
    setFeedbackMsg(`Vehicle ${plate} marked exited complex.`);
    setTimeout(() => setFeedbackMsg(''), 4000);
  };

  // Handle Bulk Import
  const handleBulkImport = async (e) => {
    e.preventDefault();
    if (!importFile) return;
    setSubmitting(true);

    const fd = new FormData();
    fd.append('file', importFile);

    const res = await bulkImportVehiclesApi(fd);
    if (res) {
      setShowImportModal(false);
      setImportFile(null);
      setFeedbackMsg(`Successfully imported vehicle log records!`);
      setTimeout(() => setFeedbackMsg(''), 4000);
      loadLogs();
    }
    setSubmitting(false);
  };

  // Helper for Duration inside format
  const formatDuration = (log) => {
    if (log.duration_minutes !== undefined && log.duration_minutes !== null) {
      const hours = Math.floor(log.duration_minutes / 60);
      const mins = log.duration_minutes % 60;
      if (hours > 0) return `${hours}h ${mins}m`;
      return `${mins} mins`;
    }
    return 'Just entered';
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
            <Car className="w-6 h-6 text-brand-500" />
            Gate & Vehicle Entry Logs
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Track residential and visitor vehicle access, flag overstay risks, and log gate entries.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={loadLogs}
            className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>

          <button
            onClick={() => setShowCameraSimModal(true)}
            className="px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-semibold rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-1.5 shadow-xs"
            title="Simulate ANPR camera hardware trigger"
          >
            <Camera className="w-3.5 h-3.5 text-indigo-600" /> Simulate Camera ANPR
          </button>

          <button
            onClick={() => setShowImportModal(true)}
            className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> Import Excel/CSV
          </button>

          <button
            onClick={() => setShowManualModal(true)}
            className="px-3.5 py-1.5 bg-navy text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-4 h-4" /> Log Vehicle Entry
          </button>
        </div>
      </div>

      {/* ANPR Camera & Tracking Hardware Notice Banner */}
      <div className="bg-gradient-to-r from-slate-50 to-indigo-50/40 border border-slate-200 rounded-lg p-3.5 flex items-start gap-3 shadow-xs">
        <Camera className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-600 space-y-0.5">
          <p className="font-bold text-navy flex items-center gap-2">
            Multi-Modal Vehicle Tracking Architecture
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
              Hardware Ready-to-Plug
            </span>
          </p>
          <p>
            Currently, gate staff can log vehicles via <span className="font-semibold text-slate-800">Manual Entry</span> or <span className="font-semibold text-slate-800">Excel Log Imports</span>.
            The automated ANPR (Automatic Number Plate Recognition) camera endpoint (<code className="font-mono text-indigo-700 bg-white px-1 rounded border border-indigo-100">POST /api/v1/vehicles/camera-event</code>)
            is live and ready to ingest plate data directly once CCTV camera hardware is installed. You can test detection right now using the <span className="font-semibold text-indigo-700">"Simulate Camera ANPR"</span> button above.
          </p>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-surface-border shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-navy shrink-0">
            <Car className="w-5 h-5 text-slate-700" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Total Entries Recorded</div>
            <div className="text-xl font-bold text-navy">{totalCount}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-surface-border shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Currently Inside</div>
            <div className="text-xl font-bold text-blue-700">{insideCount}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-surface-border shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Registered Residents Inside</div>
            <div className="text-xl font-bold text-emerald-700">{residentsInside}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-surface-border shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Overstay Alerts (Risk)</div>
            <div className="text-xl font-bold text-rose-700">{overstayCount}</div>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-1 overflow-x-auto">
          {[
            { id: 'all', label: 'All Gate Logs' },
            { id: 'inside', label: `Currently Inside (${insideCount})` },
            { id: 'overstay', label: `Overstay Alerts (${overstayCount})` },
            { id: 'residents', label: 'Registered Residents' },
            { id: 'visitors', label: 'Visitors & Guests' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                selectedTab === tab.id
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
              placeholder="Search plate, unit, visitor..."
              className="bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none w-full"
            />
          </div>
        </div>
      </div>

      {/* Vehicles Table */}
      <div className="bg-white rounded-lg border border-surface-border shadow-sm overflow-hidden">
        <div className="p-4 border-b border-surface-border bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Car className="w-4 h-4 text-brand-500" />
            <h2 className="font-bold text-navy text-sm">Gate Entrance Records ({filteredLogs.length})</h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">Automatic Plate Registration Check</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading gate logs...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <p className="text-sm font-semibold">No vehicle logs found for this filter.</p>
            <p className="text-xs text-slate-400">Click "Log Vehicle Entry" or "Simulate Camera ANPR" to record an entry.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">License Plate</th>
                  <th className="py-3 px-4">Access Status</th>
                  <th className="py-3 px-4">Owner / Resident Unit</th>
                  <th className="py-3 px-4">Entry Time</th>
                  <th className="py-3 px-4">Duration Inside</th>
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredLogs.map((log) => {
                  const isOverstay = log.is_inside && log.is_flagged_overstay;
                  const isResident = log.is_registered;

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Plate Badge */}
                      <td className="py-3 px-4">
                        <div className="inline-flex items-center px-2.5 py-1 rounded bg-slate-900 text-white font-mono font-bold text-xs tracking-wider shadow-xs border border-slate-700">
                          {log.vehicle_plate}
                        </div>
                      </td>

                      {/* Status Tag */}
                      <td className="py-3 px-4">
                        {isOverstay ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-bold text-[10px]">
                            <AlertTriangle className="w-3 h-3 text-rose-600" /> OVERSTAY RISK
                          </span>
                        ) : isResident ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px]">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" /> RESIDENT
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-bold text-[10px]">
                            VISITOR
                          </span>
                        )}
                      </td>

                      {/* Resident Info */}
                      <td className="py-3 px-4">
                        {log.resident_unit ? (
                          <div>
                            <span className="font-bold text-slate-800 block">{log.resident_unit}</span>
                            <span className="text-slate-500 text-[11px]">{log.resident_name || 'Registered Resident'}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Unassigned Visitor</span>
                        )}
                      </td>

                      {/* Entry Time */}
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                        {log.entry_time ? String(log.entry_time).slice(0, 16).replace('T', ' ') : 'N/A'}
                      </td>

                      {/* Duration Inside */}
                      <td className="py-3 px-4">
                        {log.is_inside ? (
                          <span className={`font-mono text-[11px] font-semibold flex items-center gap-1 ${
                            isOverstay ? 'text-rose-600 font-bold' : 'text-blue-600'
                          }`}>
                            <Clock className="w-3 h-3" /> {formatDuration(log)}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono text-[11px]">Exited</span>
                        )}
                      </td>

                      {/* Ingestion Source */}
                      <td className="py-3 px-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                          log.source === 'camera'
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                            : log.source === 'excel_import'
                            ? 'bg-slate-100 text-slate-700 border-slate-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          {log.source === 'camera' ? '📷 Camera ANPR' : log.source === 'excel_import' ? '📊 Excel Import' : '✍️ Manual'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        {log.is_inside ? (
                          <button
                            onClick={() => handleMarkExit(log.id, log.vehicle_plate)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] rounded transition-colors inline-flex items-center gap-1 shadow-xs"
                            title="Record vehicle departure from society"
                          >
                            <LogOut className="w-3 h-3" /> Mark Exited
                          </button>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">Completed</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: MANUAL VEHICLE ENTRY LOG */}
      {showManualModal && (
        <div className="fixed inset-0 bg-navy/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-surface-border">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Car className="w-5 h-5 text-brand-500" />
                <h3 className="font-bold text-navy text-base">Log Vehicle Gate Entry</h3>
              </div>
              <button
                onClick={() => setShowManualModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">License Plate Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. KHI-8921 or LEB-4412"
                  value={manualPlate}
                  onChange={(e) => setManualPlate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-800 uppercase focus:outline-none focus:border-brand-500 focus:bg-white"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  The system will automatically cross-check with the resident vehicle registry.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-navy text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Recording...' : 'Record Entrance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CAMERA ANPR SIMULATOR */}
      {showCameraSimModal && (
        <div className="fixed inset-0 bg-navy/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-surface-border space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="font-bold text-navy text-base">Simulate ANPR Camera Trigger</h3>
                  <p className="text-xs text-slate-500">Test automatic license plate recognition webhook</p>
                </div>
              </div>
              <button
                onClick={() => setShowCameraSimModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCameraSimulate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Camera Optical Sensor Location</label>
                <select
                  value={cameraId}
                  onChange={(e) => setCameraId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white"
                >
                  <option value="Gate-1-Entrance">Gate 1 - Main Entrance (ANPR Optical)</option>
                  <option value="Gate-2-Basement">Gate 2 - Basement Resident Ramp</option>
                  <option value="Service-Gate-North">Service Gate - Utility & Delivery</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Detected License Plate *</label>
                <div className="space-y-2">
                  <input
                    type="text"
                    required
                    value={cameraPlate}
                    onChange={(e) => setCameraPlate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-800 uppercase focus:outline-none focus:border-indigo-500 focus:bg-white"
                  />
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-slate-400">Quick Test Samples:</span>
                    <button
                      type="button"
                      onClick={() => setCameraPlate('KHI-1234')}
                      className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-mono font-bold hover:bg-emerald-100"
                    >
                      KHI-1234 (Resident)
                    </button>
                    <button
                      type="button"
                      onClick={() => setCameraPlate('KHI-5678')}
                      className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-mono font-bold hover:bg-emerald-100"
                    >
                      KHI-5678 (Resident)
                    </button>
                    <button
                      type="button"
                      onClick={() => setCameraPlate('LEB-9988')}
                      className="px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-mono font-bold hover:bg-amber-100"
                    >
                      LEB-9988 (Visitor)
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-lg text-[11px] text-indigo-900 space-y-1">
                <p className="font-bold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  Hardware-ready Webhook
                </p>
                <p>
                  Hitting trigger dispatches to <code className="font-mono bg-white px-1 rounded">/api/v1/vehicles/camera-event</code> exactly as ANPR camera software will in production.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCameraSimModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Triggering...' : 'Trigger Camera Detection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: EXCEL / CSV BULK IMPORT */}
      {showImportModal && (
        <div className="fixed inset-0 bg-navy/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-surface-border">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-brand-500" />
                <h3 className="font-bold text-navy text-base">Bulk Import Vehicle Logs</h3>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleBulkImport} className="space-y-4 pt-4">
              <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center space-y-2 hover:border-brand-500 transition-colors">
                <UploadCloud className="w-8 h-8 text-slate-400 mx-auto" />
                <div className="text-xs text-slate-600">
                  <label className="font-bold text-brand-600 hover:underline cursor-pointer">
                    Click to select CSV or Excel file
                    <input
                      type="file"
                      accept=".csv, .xlsx, .xls"
                      onChange={(e) => setImportFile(e.target.files[0])}
                      className="hidden"
                    />
                  </label>
                  <p className="text-[11px] text-slate-400 mt-1">Accepts gate registers or ANPR batch exports</p>
                </div>
                {importFile && (
                  <p className="text-xs font-bold text-navy font-mono">{importFile.name}</p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!importFile || submitting}
                  className="px-4 py-2 bg-navy text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Importing...' : 'Upload & Ingest Logs'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
