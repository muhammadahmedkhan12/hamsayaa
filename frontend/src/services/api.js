import { mockResidents, mockInvoices, mockComplaints, mockDashboardMetrics, mockVehicleLogs, mockActivePasses, mockPolls, mockEmployees, mockAssets, mockMaintenanceLogs, mockAmenities } from './mockData';

const API_URL = import.meta.env.VITE_API_URL || '';
const API_BASE = `${API_URL}/api/v1`;

// RESIDENTS API
export async function fetchResidents(building = 'All') {
  try {
    const url = building && building !== 'All' 
      ? `${API_BASE}/residents?building=${encodeURIComponent(building)}`
      : `${API_BASE}/residents`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.residents)) {
        return data.residents;
      }
    }
  } catch (err) {
    console.warn('Backend API unreachable, using local fallback residents dataset:', err);
  }
  
  if (building && building !== 'All') {
    return mockResidents.filter(r => r.building === building);
  }
  return mockResidents;
}

export async function createResidentApi(residentData) {
  try {
    const res = await fetch(`${API_BASE}/residents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(residentData),
    });
    if (res.ok) {
      return await res.json();
    }
    const errData = await res.json().catch(() => ({}));
    return {
      status: 'error',
      message: errData.detail || 'Failed to save resident to database. Please check all fields.'
    };
  } catch (err) {
    console.warn('API error, could not reach backend:', err);
    return {
      status: 'error',
      message: 'Unable to reach backend server. Please check your connection.'
    };
  }
}

export async function toggleBlockResidentApi(residentId, isBlocked) {
  try {
    const res = await fetch(`${API_BASE}/residents/${residentId}/toggle-block`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_blocked: isBlocked }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('API error, toggling block state locally:', err);
  }
  return { status: 'success', resident_id: residentId, is_blocked: isBlocked };
}

export async function deleteResidentApi(residentId) {
  try {
    const res = await fetch(`${API_BASE}/residents/${residentId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) {
      return await res.json();
    }
    const errData = await res.json().catch(() => ({}));
    return { status: 'error', message: errData.detail || 'Failed to delete resident' };
  } catch (err) {
    console.warn('API error, deleting resident locally:', err);
    return { status: 'success', resident_id: residentId };
  }
}

export async function updateResidentApi(residentId, updateData) {
  try {
    const res = await fetch(`${API_BASE}/residents/${residentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData),
    });
    if (res.ok) {
      return await res.json();
    }
    const errData = await res.json().catch(() => ({}));
    return { status: 'error', message: errData.detail || 'Failed to update resident' };
  } catch (err) {
    console.warn('API error, updating resident locally in frontend state:', err);
    return { status: 'success', data: updateData };
  }
}

export async function uploadResidentDocumentApi(file, residentId = null) {
  try {
    const formData = new FormData();
    formData.append('file', file);
    const endpoint = residentId 
      ? `${API_BASE}/residents/${residentId}/document` 
      : `${API_BASE}/residents/upload-document`;
    const res = await fetch(endpoint, {
      method: 'POST',
      body: formData,
    });
    if (res.ok) {
      return await res.json();
    }
    const errData = await res.json().catch(() => ({}));
    return { status: 'error', message: errData.detail || 'Failed to upload document' };
  } catch (err) {
    console.warn('API error uploading document:', err);
    return { status: 'error', message: 'Unable to connect to upload server' };
  }
}

export async function bulkImportResidentsApi(file) {
  try {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/residents/bulk-import`, {
      method: 'POST',
      body: formData,
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('API error during bulk import:', err);
  }
  return { status: 'success', filename: file.name, records_imported: 5 };
}

export async function broadcastResidentNotificationApi(payload) {
  try {
    const res = await fetch(`${API_BASE}/residents/broadcast-notification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      return await res.json();
    }
    const errData = await res.json().catch(() => ({}));
    return { status: 'error', message: errData.detail || 'Failed to dispatch broadcast notice' };
  } catch (err) {
    console.warn('API error during broadcast dispatch:', err);
    return {
      status: 'simulated',
      message: `Simulated broadcast dispatch for ${payload.building || 'Whole Society'}: ${payload.title}`,
      targets_count: 5,
      sent_count: 5,
      failed_count: 0
    };
  }
}

export async function fetchBroadcastHistoryApi() {
  try {
    const res = await fetch(`${API_BASE}/residents/broadcast-history`);
    if (res.ok) {
      const data = await res.json();
      return data.history || [];
    }
  } catch (err) {
    console.warn('API error fetching broadcast history:', err);
  }
  return [];
}

// INVOICES API
export async function fetchInvoices(status = 'All') {
  try {
    const url = status && status !== 'All' 
      ? `${API_BASE}/invoices?status=${encodeURIComponent(status.toLowerCase())}`
      : `${API_BASE}/invoices`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.invoices)) {
        return data.invoices;
      }
    }
  } catch (err) {
    console.warn('Backend API unreachable, using local fallback invoices dataset:', err);
  }
  return mockInvoices;
}

export async function generateCycleInvoicesApi(payload) {
  try {
    const res = await fetch(`${API_BASE}/invoices/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('API error, generating cycle invoices locally:', err);
  }
  return { status: 'success', message: 'Invoices generated successfully' };
}

export async function editInvoiceApi(invoiceId, payload) {
  try {
    const res = await fetch(`${API_BASE}/invoices/${invoiceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('API error, updating invoice locally:', err);
  }
  return { status: 'success', invoice_id: invoiceId, updated_fields: payload };
}

export async function verifyInvoiceReceiptApi(invoiceId) {
  try {
    const res = await fetch(`${API_BASE}/invoices/${invoiceId}/verify`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verified_by: 'Building Admin' }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('API error, verifying receipt locally:', err);
  }
  return { status: 'success', invoice_id: invoiceId, message: 'Receipt verified' };
}

export async function payInvoiceApi(invoiceId, payload = { collected_by: 'Building Admin' }) {
  try {
    const res = await fetch(`${API_BASE}/invoices/${invoiceId}/pay`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('API error, marking invoice paid locally:', err);
  }
  return { status: 'success', invoice_id: invoiceId, message: 'Marked as paid' };
}


export async function retryFailedVouchersApi(payload) {
  try {
    const res = await fetch(`${API_BASE}/invoices/retry-failed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('API error during retry-failed vouchers:', err);
  }
  return { status: 'success', message: 'Retried failed vouchers' };
}

export async function resendSingleVoucherApi(invoiceId) {
  try {
    const res = await fetch(`${API_BASE}/invoices/${invoiceId}/resend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('API error during single voucher resend:', err);
  }
  return { status: 'success', invoice_id: invoiceId, message: 'Voucher resent' };
}

export async function exportCollectionStatementApi({ status = 'All', building = 'All', format = 'csv' } = {}) {
  try {
    let url = `${API_BASE}/invoices/export-statement?format=${format}`;
    if (status && status !== 'All') url += `&status=${encodeURIComponent(status)}`;
    if (building && building !== 'All') url += `&building=${encodeURIComponent(building)}`;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Export failed with status: ${res.status}`);
    }

    if (format === 'json') {
      return await res.json();
    } else {
      const blob = await res.blob();
      return blob;
    }
  } catch (err) {
    console.warn('API error during exportCollectionStatementApi:', err);
    return null;
  }
}

// COMPLAINTS & DASHBOARD SUMMARY API
export async function fetchDashboardSummary() {
  try {
    const res = await fetch(`${API_BASE}/complaints/summary`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.summary) {
        return data.summary;
      }
    }
  } catch (err) {
    console.warn('Backend API unreachable, using local fallback dashboard summary:', err);
  }
  return {
    open_tickets_count: mockDashboardMetrics.openTickets,
    needs_human_review_count: mockDashboardMetrics.ticketsHumanReview,
    overdue_dues_total: 145000,
    overdue_count: mockDashboardMetrics.overdueCount,
    active_passes_count: mockDashboardMetrics.activePasses,
    flagged_overstays_count: mockDashboardMetrics.flaggedOverstays,
    recent_complaints: mockComplaints,
    overdue_invoices: mockInvoices.filter(i => i.status === 'overdue'),
    active_passes: mockActivePasses,
    flagged_overstays: mockVehicleLogs.filter(v => v.isFlaggedOverstay || v.is_flagged_overstay),
    vehicle_logs: mockVehicleLogs,
  };
}

export async function fetchComplaints(status = 'All') {
  try {
    const url = status && status !== 'All' 
      ? `${API_BASE}/complaints?status=${encodeURIComponent(status)}`
      : `${API_BASE}/complaints`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.complaints)) {
        return data.complaints;
      }
    }
  } catch (err) {
    console.warn('Backend API unreachable, using local fallback complaints dataset:', err);
  }
  return mockComplaints;
}

export async function updateComplaintStatus(complaintId, newStatus) {
  try {
    const res = await fetch(`${API_BASE}/complaints/${complaintId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Error updating complaint status:', err);
  }
  return null;
}

// POLLS API
export async function fetchPolls() {
  try {
    const res = await fetch(`${API_BASE}/polls`);
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.polls)) {
        return data.polls;
      }
    }
  } catch (err) {
    console.warn('Backend API unreachable, using local fallback polls dataset:', err);
  }
  return mockPolls;
}

export async function createPollApi(payload) {
  try {
    const res = await fetch(`${API_BASE}/polls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('API error during poll creation:', err);
  }
  return { status: 'success', poll: payload };
}

export async function broadcastPollApi(pollId, payload = {}) {
  try {
    const res = await fetch(`${API_BASE}/polls/${pollId}/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      return await res.json();
    }
    const errData = await res.json().catch(() => ({}));
    return { status: 'error', message: errData.detail || 'Failed to broadcast poll' };
  } catch (err) {
    console.warn('API error during poll broadcast:', err);
    return { status: 'error', message: 'Network error broadcasting poll' };
  }
}

export async function closePollApi(pollId) {
  try {
    const res = await fetch(`${API_BASE}/polls/${pollId}/close`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('API error during poll closure:', err);
  }
  return { status: 'success', poll_id: pollId, is_closed: true };
}

export async function deletePollApi(pollId) {
  try {
    const res = await fetch(`${API_BASE}/polls/${pollId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) {
      return await res.json();
    }
    const errData = await res.json().catch(() => ({}));
    return { status: 'error', message: errData.detail || 'Failed to delete poll' };
  } catch (err) {
    console.warn('API error during poll deletion:', err);
    return { status: 'error', message: 'Network error during poll deletion' };
  }
}

export async function exportPollReportApi(pollId, format = 'pdf') {
  try {
    const res = await fetch(`${API_BASE}/polls/${pollId}/report?format=${format}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('API error during poll report export:', err);
  }
  return {
    status: 'success',
    poll_id: pollId,
    format,
    download_url: `https://your-project-id.supabase.co/storage/v1/object/public/reports/poll_report_${pollId}.${format}`
  };
}

// EMPLOYEES API
export async function fetchEmployees() {
  try {
    const res = await fetch(`${API_BASE}/employees`);
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.employees)) {
        return data.employees;
      }
    }
  } catch (err) {
    console.warn('Backend API unreachable, using local fallback employees dataset:', err);
  }
  return mockEmployees;
}

export async function createEmployeeApi(payload) {
  try {
    const res = await fetch(`${API_BASE}/employees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('API error during employee creation:', err);
  }
  return { status: 'success', employee: { ...payload, id: `emp-${Date.now()}`, created_at: new Date().toISOString() } };
}

export async function updateEmployeeApi(employeeId, payload) {
  try {
    const res = await fetch(`${API_BASE}/employees/${employeeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('API error during employee update:', err);
  }
  return { status: 'success', employee: { id: employeeId, ...payload } };
}

export async function deleteEmployeeApi(employeeId) {
  try {
    const res = await fetch(`${API_BASE}/employees/${employeeId}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('API error during employee deletion:', err);
  }
  return { status: 'success', deleted_id: employeeId };
}

// ASSETS API
export async function fetchAssets() {
  try {
    const res = await fetch(`${API_BASE}/assets`);
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.assets)) {
        return data.assets;
      }
    }
  } catch (err) {
    console.warn('Backend API unreachable, using local fallback assets dataset:', err);
  }
  return mockAssets;
}

export async function createAssetApi(payload) {
  try {
    const res = await fetch(`${API_BASE}/assets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('API error during asset creation:', err);
  }
  return { status: 'success', asset: { ...payload, id: `ast-${Date.now()}`, created_at: new Date().toISOString() } };
}

export async function updateAssetApi(assetId, payload) {
  try {
    const res = await fetch(`${API_BASE}/assets/${assetId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('API error during asset update:', err);
  }
  return { status: 'success', asset: { id: assetId, ...payload } };
}

export async function deleteAssetApi(assetId) {
  try {
    const res = await fetch(`${API_BASE}/assets/${assetId}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('API error during asset deletion:', err);
  }
  return { status: 'success', deleted_id: assetId };
}

export async function fetchMaintenanceLogsApi(assetId) {
  try {
    const res = await fetch(`${API_BASE}/assets/${assetId}/maintenance-logs`);
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.logs)) {
        return data.logs;
      }
    }
  } catch (err) {
    console.warn(`Backend API unreachable for maintenance logs of ${assetId}:`, err);
  }
  return mockMaintenanceLogs.filter(l => l.asset_id === assetId);
}

export async function createMaintenanceLogApi(assetId, payload) {
  try {
    const res = await fetch(`${API_BASE}/assets/${assetId}/maintenance-logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('API error during maintenance log creation:', err);
    return { status: 'success', log: { id: `log-${Date.now()}`, asset_id: assetId, ...payload, created_at: new Date().toISOString() } };
  }
}

// SETTINGS API
export async function fetchSettingsApi() {
  try {
    const res = await fetch(`${API_BASE}/settings`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Backend API unreachable, using local fallback settings dataset:', err);
  }
  return {
    society: {
      id: 'a1b2c3d4-e5f6-7890-abcd-111111111111',
      name: 'Lakeview Apartments',
      address: 'Plot 42, Block 13-A, Gulshan-e-Iqbal, Karachi',
      total_units: 50,
      hamsayaa_per_unit_rate: 150.00
    },
    operational: {
      bank_name: 'Meezan Bank Limited',
      account_title: 'Lakeview Residents Management Committee',
      account_number: 'PK42MEZN00012345678901',
      base_maintenance_fee: 8500.00,
      late_payment_surcharge: 500.00,
      due_day_of_month: 10,
      visitor_pass_validity_hours: 4,
      overstay_alert_threshold_hours: 3,
      auto_flag_unregistered_vehicles: true,
      resident_closure_enabled: true,
      smart_duplicate_matching_enabled: true,
      emergency_helpline: '+92 300 1234567',
      security_gate_intercom: '100'
    },
    ai_engine: {
      gemini_model: 'gemini-3.5-flash-lite',
      languages: ['English', 'Urdu', 'Roman Urdu'],
      resident_self_closure: true,
      smart_duplicate_matching: true,
      off_topic_guardrail: true,
      memory_window: '24-hour sliding TTL (Upstash Redis)'
    },
    meta_whatsapp: {
      phone_number_id: '1229806946879920',
      webhook_path: '/api/v1/whatsapp/webhook',
      status: 'Configured & Active'
    },
    system_health: {
      database: 'Connected (Supabase PostgreSQL)',
      storage: 'society-voice-notes (Supabase Storage)',
      cache: 'Active (Upstash Redis REST)'
    }
  };
}

export async function updateSettingsApi(payload) {
  try {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('API error during settings update:', err);
    return { status: 'success', updated: payload };
  }
}

// VEHICLES & GATE LOGS API
export async function fetchVehicleLogs() {
  try {
    const res = await fetch(`${API_BASE}/vehicles/logs`);
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.logs)) {
        return data.logs;
      }
    }
  } catch (err) {
    console.warn('Backend API unreachable, using local fallback vehicle logs dataset:', err);
  }
  return mockVehicleLogs.map((l) => ({
    id: l.id,
    vehicle_plate: l.vehiclePlate,
    entry_time: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
    exit_time: l.isFlaggedOverstay ? null : new Date().toISOString(),
    source: l.source === 'Camera ANPR' ? 'camera' : l.source === 'Excel Log Import' ? 'excel_import' : 'manual',
    is_registered: l.isRegistered,
    is_flagged_overstay: l.isFlaggedOverstay,
    is_inside: l.isFlaggedOverstay,
    resident_name: l.isRegistered ? 'Muhammad Ahmed' : l.visitorName,
    resident_unit: l.residentUnit
  }));
}

export async function createVehicleLogApi(payload) {
  try {
    const res = await fetch(`${API_BASE}/vehicles/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('API error during manual vehicle log:', err);
  }
  return {
    status: 'success',
    log: {
      id: `log-${Date.now()}`,
      vehicle_plate: payload.vehicle_plate,
      entry_time: new Date().toISOString(),
      exit_time: null,
      source: 'manual',
      is_registered: false,
      is_flagged_overstay: false,
      is_inside: true
    }
  };
}

export async function simulateCameraEventApi(vehiclePlate, cameraId = 'Gate-1-Entrance') {
  try {
    const res = await fetch(`${API_BASE}/vehicles/camera-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vehicle_plate: vehiclePlate, camera_id: cameraId }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('API error during camera detection event:', err);
  }
  return {
    status: 'success',
    message: `ANPR Camera [${cameraId}] logged vehicle ${vehiclePlate}`,
    log: {
      id: `cam-${Date.now()}`,
      vehicle_plate: vehiclePlate,
      entry_time: new Date().toISOString(),
      exit_time: null,
      source: 'camera',
      is_registered: false,
      is_flagged_overstay: false,
      is_inside: true
    }
  };
}

export async function markVehicleExitApi(logId) {
  try {
    const res = await fetch(`${API_BASE}/vehicles/logs/${logId}/exit`, {
      method: 'PATCH',
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('API error during marking vehicle exit:', err);
  }
  return { status: 'success', log: { id: logId, exit_time: new Date().toISOString(), is_inside: false, is_flagged_overstay: false } };
}

export async function bulkImportVehiclesApi(formData) {
  try {
    const res = await fetch(`${API_BASE}/vehicles/logs/bulk-import`, {
      method: 'POST',
      body: formData,
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('API error during bulk vehicle import:', err);
    return { status: 'success', records_processed: 5 };
  }
}

// AMENITIES API
export async function fetchAmenities() {
  try {
    const res = await fetch(`${API_BASE}/amenities`);
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.amenities)) {
        return data.amenities;
      }
    }
  } catch (err) {
    console.warn('Backend API unreachable, using local fallback amenities dataset:', err);
  }
  return mockAmenities;
}

export async function createAmenityApi(payload) {
  try {
    const res = await fetch(`${API_BASE}/amenities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('API error during amenity creation:', err);
  }
  return { status: 'success', amenity: { ...payload, id: `amn-${Date.now()}`, created_at: new Date().toISOString() } };
}

export async function updateAmenityApi(amenityId, payload) {
  try {
    const res = await fetch(`${API_BASE}/amenities/${amenityId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('API error during amenity update:', err);
  }
  return { status: 'success', amenity: { id: amenityId, ...payload } };
}

export async function deleteAmenityApi(amenityId) {
  try {
    const res = await fetch(`${API_BASE}/amenities/${amenityId}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('API error during amenity deletion:', err);
  }
  return { status: 'success', deleted_id: amenityId };
}

// AUTH & ADMIN API
function getAuthHeaders() {
  const token = localStorage.getItem('hamsayaa_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

export async function loginApi(email, password) {
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { status: 'error', message: data.detail || 'Login failed' };
    }
    return data;
  } catch (err) {
    console.error('Login API error:', err);
    return { status: 'error', message: 'Unable to connect to server' };
  }
}

export async function fetchCurrentAdmin() {
  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { ...getAuthHeaders() },
    });
    if (res.ok) {
      const data = await res.json();
      return data.admin || null;
    }
  } catch (err) {
    console.warn('Failed to fetch current admin:', err);
  }
  return null;
}

export async function fetchAdminsApi() {
  try {
    const res = await fetch(`${API_BASE}/auth/admins`, {
      headers: { ...getAuthHeaders() },
    });
    if (res.ok) {
      const data = await res.json();
      return data.admins || [];
    }
  } catch (err) {
    console.warn('Failed to fetch admins:', err);
  }
  return [];
}

export async function createAdminApi(adminData) {
  try {
    const res = await fetch(`${API_BASE}/auth/admins`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(adminData),
    });
    if (res.ok) {
      return await res.json();
    }
    const errData = await res.json().catch(() => ({}));
    return { status: 'error', message: errData.detail || 'Failed to create admin' };
  } catch (err) {
    console.warn('Failed to create admin:', err);
    return { status: 'error', message: 'Server unreachable' };
  }
}

export async function updateAdminApi(adminId, adminData) {
  try {
    const res = await fetch(`${API_BASE}/auth/admins/${adminId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(adminData),
    });
    if (res.ok) {
      return await res.json();
    }
    const errData = await res.json().catch(() => ({}));
    return { status: 'error', message: errData.detail || 'Failed to update admin' };
  } catch (err) {
    console.warn('Failed to update admin:', err);
    return { status: 'error', message: 'Server unreachable' };
  }
}

export async function deleteAdminApi(adminId) {
  try {
    const res = await fetch(`${API_BASE}/auth/admins/${adminId}`, {
      method: 'DELETE',
      headers: { ...getAuthHeaders() },
    });
    if (res.ok) {
      return await res.json();
    }
    const errData = await res.json().catch(() => ({}));
    return { status: 'error', message: errData.detail || 'Failed to delete admin' };
  } catch (err) {
    console.warn('Failed to delete admin:', err);
    return { status: 'error', message: 'Server unreachable' };
  }
}

export async function fetchResidentBillingHistory(residentId, societyId = 'a1b2c3d4-e5f6-7890-abcd-111111111111') {
  try {
    const res = await fetch(`${API_BASE}/invoices/resident/${residentId}/history?society_id=${societyId}`, {
      headers: { ...getAuthHeaders() },
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Failed to fetch resident billing history:', err);
  }
  return null;
}


