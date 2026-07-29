// Central Mock Data Provider for Hamsayaa SaaS Dashboard

export const mockSocieties = [
  { id: 'a1b2c3d4-e5f6-7890-abcd-111111111111', name: 'Lakeview Apartments', units: 50, address: 'Gulshan-e-Iqbal, Karachi' },
  { id: 'b2c3d4e5-f6a7-8901-bcde-222222222222', name: 'Askari IV Gated Society', units: 120, address: 'Rashid Minhas Rd, Karachi' },
];

export const mockAdminUser = {
  name: 'Absar Anwer',
  email: 'admin@lakeview.com',
  role: 'Building Supervisor',
  avatar: 'AA',
};

export const mockDashboardMetrics = {
  openTickets: 5,
  ticketsHumanReview: 1,
  overdueAmount: '145,000',
  overdueCount: 8,
  activePasses: 8,
  flaggedOverstays: 2,
  collectionRate: '82.4%',
  momGrowth: '+4.1%',
};

export const mockComplaints = [
  {
    id: 'TCK-1049',
    unit: 'A-402',
    residentName: 'Fatima Raza',
    category: 'Water & Plumbing',
    description: 'Main water line pressure drops significantly during evening hours.',
    status: 'needs_human_review',
    statusLabel: 'Needs Human Review',
    timestamp: '12 mins ago',
    source: 'WhatsApp',
  },
  {
    id: 'TCK-1048',
    unit: 'B-108',
    residentName: 'Bilal Sheikh',
    category: 'Electrical',
    description: 'Corridor light fixture flickering near elevator entrance.',
    status: 'open',
    statusLabel: 'Open',
    timestamp: '1 hour ago',
    source: 'WhatsApp',
  },
  {
    id: 'TCK-1045',
    unit: 'C-301',
    residentName: 'Hamza Tariq',
    category: 'Security Gate',
    description: 'Intercom speaker noise when calling security office.',
    status: 'in_progress',
    statusLabel: 'In Progress',
    timestamp: '3 hours ago',
    source: 'WhatsApp',
  },
  {
    id: 'TCK-1042',
    unit: 'A-101',
    residentName: 'Muhammad Ahmed',
    category: 'General Inquiry',
    description: 'Gym slot timings confirmation for morning session.',
    status: 'resolved',
    statusLabel: 'Resolved',
    timestamp: 'Yesterday',
    source: 'WhatsApp',
  },
];

export const mockVehicleLogs = [
  {
    id: 'LOG-8891',
    vehiclePlate: 'KHI-8921',
    visitorName: 'Tariq Mahmood',
    residentUnit: 'A-101',
    entryTime: '11:15 AM Today',
    passExpiry: '14:00 Today',
    isRegistered: false,
    isFlaggedOverstay: true,
    source: 'Manual Gate Entry',
    statusLabel: 'OVERSTAY FLAG',
  },
  {
    id: 'LOG-8890',
    vehiclePlate: 'LEB-4412',
    visitorName: 'Usman Chaudhry',
    residentUnit: 'B-202',
    entryTime: '13:00 PM Today',
    passExpiry: '16:30 Today',
    isRegistered: false,
    isFlaggedOverstay: true,
    source: 'Manual Gate Entry',
    statusLabel: 'OVERSTAY FLAG',
  },
  {
    id: 'LOG-8889',
    vehiclePlate: 'KHI-1234',
    visitorName: 'Muhammad Ahmed (Resident)',
    residentUnit: 'A-101',
    entryTime: '15:10 PM Today',
    passExpiry: 'Indefinite',
    isRegistered: true,
    isFlaggedOverstay: false,
    source: 'Excel Log Import',
    statusLabel: 'REGISTERED RESIDENT',
  },
  {
    id: 'LOG-8888',
    vehiclePlate: 'B-7712',
    visitorName: 'Zubair Khan',
    residentUnit: 'C-301',
    entryTime: '15:30 PM Today',
    passExpiry: '19:00 Today',
    isRegistered: false,
    isFlaggedOverstay: false,
    source: 'Manual Gate Entry',
    statusLabel: 'ACTIVE PASS',
  },
];

export const mockActivePasses = [
  {
    id: 'PASS-9821',
    code: 'LV-9821',
    visitorName: 'Tariq Mahmood',
    visitorCNIC: '42101-9988776-5',
    residentName: 'Muhammad Ahmed (A-101)',
    vehiclePlate: 'KHI-8921',
    validFrom: '12:00 PM Today',
    validUntil: '14:00 PM Today',
    status: 'expired',
  },
  {
    id: 'PASS-9822',
    code: 'LV-9822',
    visitorName: 'Zubair Khan',
    visitorCNIC: '42101-5544332-1',
    residentName: 'Hamza Tariq (C-301)',
    vehiclePlate: 'B-7712',
    validFrom: '15:30 PM Today',
    validUntil: '19:00 PM Today',
    status: 'active',
  },
];
