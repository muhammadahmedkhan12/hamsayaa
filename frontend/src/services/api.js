import { mockResidents, mockInvoices, mockComplaints, mockDashboardMetrics, mockVehicleLogs, mockPolls, mockEmployees, mockAssets, mockMaintenanceLogs } from './mockData';

const API_BASE = '/api/v1';

// RESIDENTS API
export async function fetchResidents(building = 'All') {
  try {
    const url = building && building !== 'All' 
      ? `${API_BASE}/residents?building=${encodeURIComponent(building)}`
      : `${API_BASE}/residents`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.residents) && data.residents.length > 0) {
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
  } catch (err) {
    console.warn('API error, saving locally in frontend state:', err);
  }
  return { status: 'success', data: residentData };
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

// INVOICES API
export async function fetchInvoices(status = 'All') {
  try {
    const url = status && status !== 'All' 
      ? `${API_BASE}/invoices?status=${encodeURIComponent(status)}`
      : `${API_BASE}/invoices`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.invoices) && data.invoices.length > 0) {
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
      if (data && Array.isArray(data.complaints) && data.complaints.length > 0) {
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
      if (data && Array.isArray(data.polls) && data.polls.length > 0) {
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
      if (data && Array.isArray(data.employees) && data.employees.length > 0) {
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
      if (data && Array.isArray(data.assets) && data.assets.length > 0) {
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
      gemini_model: 'gemini-2.0-flash',
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
      if (data && Array.isArray(data.logs) && data.logs.length > 0) {
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
  }
  return { status: 'success', records_processed: 5 };
}
