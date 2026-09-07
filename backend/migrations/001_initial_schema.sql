-- Hamsayaa PostgreSQL Database Schema Migration v1.4
-- Aligned with Section 2 of Hamsayaa TRD v1.4

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Societies (Tenants)
CREATE TABLE IF NOT EXISTS societies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    total_units INT NOT NULL,
    hamsayaa_per_unit_rate DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Dashboard Users (Admin only)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id UUID REFERENCES societies(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) CHECK (role IN ('admin')) DEFAULT 'admin',
    auth_provider VARCHAR(50) DEFAULT 'supabase_auth',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Residents Table
CREATE TABLE IF NOT EXISTS residents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id UUID REFERENCES societies(id) ON DELETE CASCADE,
    building VARCHAR(100) DEFAULT 'Block A',
    name VARCHAR(255) NOT NULL,
    unit_number VARCHAR(50) NOT NULL,
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    cnic VARCHAR(15),
    is_owner BOOLEAN DEFAULT TRUE,
    is_tenant BOOLEAN DEFAULT FALSE,
    is_blocked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(society_id, building, unit_number, phone_number)
);

-- 4. Registered Resident Vehicles
CREATE TABLE IF NOT EXISTS registered_vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id UUID REFERENCES societies(id) ON DELETE CASCADE,
    resident_id UUID REFERENCES residents(id) ON DELETE CASCADE,
    vehicle_plate VARCHAR(20) NOT NULL,
    vehicle_type VARCHAR(50) DEFAULT 'Car',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Dues & Cumulative Invoices (Resident-facing)
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id UUID REFERENCES societies(id) ON DELETE CASCADE,
    resident_id UUID REFERENCES residents(id) ON DELETE CASCADE,
    society_maintenance_fee DECIMAL(10,2) NOT NULL,
    hamsayaa_saas_fee DECIMAL(10,2) NOT NULL,
    utility_charges DECIMAL(10,2) DEFAULT 0.00,
    total_amount DECIMAL(10,2) GENERATED ALWAYS AS (society_maintenance_fee + hamsayaa_saas_fee + utility_charges) STORED,
    due_date DATE NOT NULL,
    status VARCHAR(20) CHECK (status IN ('unpaid', 'paid', 'overdue', 'verified')) DEFAULT 'unpaid',
    receipt_image_url TEXT,
    account_shown TEXT,
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Society Bills (Hamsayaa charges to society)
CREATE TABLE IF NOT EXISTS society_bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id UUID REFERENCES societies(id) ON DELETE CASCADE,
    billing_period_start DATE NOT NULL,
    billing_period_end DATE NOT NULL,
    unit_count INT NOT NULL,
    per_unit_rate DECIMAL(10,2) NOT NULL,
    total_amount DECIMAL(10,2) GENERATED ALWAYS AS (unit_count * per_unit_rate) STORED,
    status VARCHAR(20) CHECK (status IN ('unpaid', 'paid', 'overdue')) DEFAULT 'unpaid',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Complaints & System Tickets
CREATE TABLE IF NOT EXISTS complaints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id UUID REFERENCES societies(id) ON DELETE CASCADE,
    resident_id UUID REFERENCES residents(id) ON DELETE CASCADE,
    ticket_number VARCHAR(20) UNIQUE NOT NULL,
    category VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    photo_url TEXT,
    status VARCHAR(30) CHECK (status IN ('open', 'in_progress', 'resolved', 'needs_human_review', 'flagged_irrelevant')) DEFAULT 'open',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- 8. Visitor & Guest Passes
CREATE TABLE IF NOT EXISTS visitor_passes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id UUID REFERENCES societies(id) ON DELETE CASCADE,
    resident_id UUID REFERENCES residents(id) ON DELETE CASCADE,
    visitor_name VARCHAR(255) NOT NULL,
    visitor_cnic VARCHAR(15) NOT NULL,
    vehicle_plate VARCHAR(20),
    pass_code VARCHAR(10) NOT NULL,
    valid_from TIMESTAMP WITH TIME ZONE NOT NULL,
    valid_until TIMESTAMP WITH TIME ZONE NOT NULL,
    pass_media_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Daily Vehicle Entry/Exit Logs
CREATE TABLE IF NOT EXISTS vehicle_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id UUID REFERENCES societies(id) ON DELETE CASCADE,
    vehicle_plate VARCHAR(20) NOT NULL,
    entry_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    exit_time TIMESTAMP WITH TIME ZONE,
    source VARCHAR(20) CHECK (source IN ('manual', 'excel_import', 'camera')) DEFAULT 'manual',
    is_registered BOOLEAN DEFAULT FALSE,
    is_flagged_overstay BOOLEAN DEFAULT FALSE,
    resolved_by UUID REFERENCES users(id)
);

-- 10. Society Polls & Voting
CREATE TABLE IF NOT EXISTS polls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id UUID REFERENCES societies(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    options JSONB NOT NULL,
    expiry_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    is_closed BOOLEAN DEFAULT FALSE,
    results_media_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. Poll Votes
CREATE TABLE IF NOT EXISTS poll_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID REFERENCES polls(id) ON DELETE CASCADE,
    resident_id UUID REFERENCES residents(id) ON DELETE CASCADE,
    selected_option VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(poll_id, resident_id)
);

-- 12. Society Expenses Ledger (Append-only once recorded)
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id UUID REFERENCES societies(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    vendor_name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    receipt_url TEXT,
    logged_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 13. Employee Directory
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id UUID REFERENCES societies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(100) NOT NULL,
    contact_info VARCHAR(255),
    shift VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 14. Asset Directory + Maintenance Logs
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id UUID REFERENCES societies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    install_date DATE,
    next_service_due DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 15. Asset Maintenance Logs
CREATE TABLE IF NOT EXISTS maintenance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id UUID REFERENCES societies(id) ON DELETE CASCADE,
    asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
    serviced_at DATE NOT NULL,
    notes TEXT,
    next_due_override DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 16. Amenities (Static info) + Bookings
CREATE TABLE IF NOT EXISTS amenities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id UUID REFERENCES societies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    timings VARCHAR(255),
    rules TEXT,
    capacity INT,
    is_bookable BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 17. Amenity Bookings
CREATE TABLE IF NOT EXISTS amenity_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    society_id UUID REFERENCES societies(id) ON DELETE CASCADE,
    amenity_id UUID REFERENCES amenities(id) ON DELETE CASCADE,
    resident_id UUID REFERENCES residents(id) ON DELETE CASCADE,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) CHECK (status IN ('pending', 'confirmed', 'cancelled')) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
