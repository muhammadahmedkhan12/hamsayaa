-- Hamsayaa Database Seed Script v1.4
-- Populate test data for Lakeview Apartments society, admin users, residents, vehicles, visitor passes, bills & invoices.

-- 1. Insert Society ("Lakeview Apartments")
INSERT INTO societies (id, name, address, total_units, hamsayaa_per_unit_rate)
VALUES (
    'a1b2c3d4-e5f6-7890-abcd-111111111111',
    'Lakeview Apartments',
    'Plot 42, Block 13-A, Gulshan-e-Iqbal, Karachi',
    50,
    150.00
) ON CONFLICT (id) DO NOTHING;

-- 2. Insert 2 Dashboard Admin Users (role: 'admin')
INSERT INTO users (id, society_id, email, role, auth_provider)
VALUES 
(
    '11111111-1111-1111-1111-111111111111',
    'a1b2c3d4-e5f6-7890-abcd-111111111111',
    'admin@lakeview.com',
    'admin',
    'supabase_auth'
),
(
    '22222222-2222-2222-2222-222222222222',
    'a1b2c3d4-e5f6-7890-abcd-111111111111',
    'supervisor@lakeview.com',
    'admin',
    'supabase_auth'
) ON CONFLICT (id) DO NOTHING;

-- 3. Insert 5 Residents (Mixed is_blocked statuses, buildings & unit numbers)
INSERT INTO residents (id, society_id, building, name, unit_number, phone_number, cnic, is_owner, is_tenant, is_blocked)
VALUES 
(
    '33333333-3333-3333-3333-111111111111',
    'a1b2c3d4-e5f6-7890-abcd-111111111111',
    'Block A',
    'Muhammad Ahmed',
    '101',
    '+923001234567',
    '42101-1234567-1',
    TRUE,
    FALSE,
    FALSE
),
(
    '33333333-3333-3333-3333-222222222222',
    'a1b2c3d4-e5f6-7890-abcd-111111111111',
    'Block A',
    'Fatima Raza',
    '102',
    '+923002345678',
    '42101-2345678-2',
    TRUE,
    FALSE,
    FALSE
),
(
    '33333333-3333-3333-3333-333333333333',
    'a1b2c3d4-e5f6-7890-abcd-111111111111',
    'Block B',
    'Bilal Sheikh',
    '201',
    '+923003456789',
    '42101-3456789-3',
    FALSE,
    TRUE,
    TRUE  -- Manually suspended due to overdue dues
),
(
    '33333333-3333-3333-3333-444444444444',
    'a1b2c3d4-e5f6-7890-abcd-111111111111',
    'Block B',
    'Zainab Malik',
    '202',
    '+923004567890',
    '42101-4567890-4',
    TRUE,
    FALSE,
    FALSE
),
(
    '33333333-3333-3333-3333-555555555555',
    'a1b2c3d4-e5f6-7890-abcd-111111111111',
    'Block C',
    'Hamza Tariq',
    '301',
    '+923005678901',
    '42101-5678901-5',
    FALSE,
    TRUE,
    FALSE
) ON CONFLICT (id) DO NOTHING;

-- 4. Sample Registered Resident Vehicles
INSERT INTO registered_vehicles (id, society_id, resident_id, vehicle_plate, vehicle_type)
VALUES
(
    '44444444-4444-4444-4444-111111111111',
    'a1b2c3d4-e5f6-7890-abcd-111111111111',
    '33333333-3333-3333-3333-111111111111',
    'KHI-1234',
    'Sedan'
),
(
    '44444444-4444-4444-4444-222222222222',
    'a1b2c3d4-e5f6-7890-abcd-111111111111',
    '33333333-3333-3333-3333-222222222222',
    'KHI-5678',
    'SUV'
) ON CONFLICT (id) DO NOTHING;

-- 5. Active Visitor Passes
INSERT INTO visitor_passes (id, society_id, resident_id, visitor_name, visitor_cnic, vehicle_plate, pass_code, valid_from, valid_until)
VALUES
(
    '55555555-5555-5555-5555-111111111111',
    'a1b2c3d4-e5f6-7890-abcd-111111111111',
    '33333333-3333-3333-3333-111111111111',
    'Tariq Mahmood',
    '42101-9988776-5',
    'KHI-8921',
    'LV-9821',
    NOW() - INTERVAL '2 hours',
    NOW() + INTERVAL '4 hours'
) ON CONFLICT (id) DO NOTHING;

-- 6. Society Bills (Hamsayaa monthly SaaS bill to Lakeview Apartments)
INSERT INTO society_bills (id, society_id, billing_period_start, billing_period_end, unit_count, per_unit_rate, status)
VALUES
(
    '66666666-6666-6666-6666-111111111111',
    'a1b2c3d4-e5f6-7890-abcd-111111111111',
    '2026-07-01',
    '2026-07-31',
    50,
    150.00,
    'unpaid'
) ON CONFLICT (id) DO NOTHING;

-- 7. Pending & Overdue Resident Invoices
INSERT INTO invoices (id, society_id, resident_id, society_maintenance_fee, hamsayaa_saas_fee, utility_charges, due_date, status, account_shown)
VALUES
(
    '77777777-7777-7777-7777-111111111111',
    'a1b2c3d4-e5f6-7890-abcd-111111111111',
    '33333333-3333-3333-3333-111111111111',
    5000.00,
    150.00,
    1200.00,
    '2026-08-05',
    'unpaid',
    'Meezan Bank - A/C 01020304050607 - Lakeview Maint Account'
),
(
    '77777777-7777-7777-7777-222222222222',
    'a1b2c3d4-e5f6-7890-abcd-111111111111',
    '33333333-3333-3333-3333-333333333333',
    5000.00,
    150.00,
    2100.00,
    '2026-07-15',
    'overdue',
    'Meezan Bank - A/C 01020304050607 - Lakeview Maint Account'
) ON CONFLICT (id) DO NOTHING;
