-- Hamsayaa Performance & Secondary B-Tree Indexes Migration
-- Version: 003
-- Description: Adds B-Tree indexes to high-frequency query columns (society_id, phone_number, status, poll_id, resident_id)
--              to optimize Dashboard summary, Invoices listing, WhatsApp webhook lookups, and voting aggregations.

-- 1. Residents indexes
CREATE INDEX IF NOT EXISTS idx_residents_society_id ON residents(society_id);
CREATE INDEX IF NOT EXISTS idx_residents_phone ON residents(phone_number);
CREATE INDEX IF NOT EXISTS idx_residents_building_unit ON residents(society_id, building, unit_number);

-- 2. Complaints indexes
CREATE INDEX IF NOT EXISTS idx_complaints_society_id ON complaints(society_id);
CREATE INDEX IF NOT EXISTS idx_complaints_resident_id ON complaints(resident_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_created_at ON complaints(created_at DESC);

-- 3. Invoices indexes
CREATE INDEX IF NOT EXISTS idx_invoices_society_id ON invoices(society_id);
CREATE INDEX IF NOT EXISTS idx_invoices_resident_id ON invoices(resident_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);

-- 4. Visitor Passes & Gate Logs indexes
CREATE INDEX IF NOT EXISTS idx_visitor_passes_society_id ON visitor_passes(society_id);
CREATE INDEX IF NOT EXISTS idx_visitor_passes_resident_id ON visitor_passes(resident_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_logs_society_id ON vehicle_logs(society_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_logs_overstay ON vehicle_logs(society_id, is_flagged_overstay);

-- 5. Polls & Poll Votes indexes
CREATE INDEX IF NOT EXISTS idx_polls_society_id ON polls(society_id);
CREATE INDEX IF NOT EXISTS idx_polls_closed ON polls(society_id, is_closed);
CREATE INDEX IF NOT EXISTS idx_poll_votes_poll_id ON poll_votes(poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_resident_id ON poll_votes(resident_id);

-- 6. Employees, Assets & Amenities indexes
CREATE INDEX IF NOT EXISTS idx_employees_society_id ON employees(society_id);
CREATE INDEX IF NOT EXISTS idx_assets_society_id ON assets(society_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_logs_asset_id ON maintenance_logs(asset_id);
CREATE INDEX IF NOT EXISTS idx_amenities_society_id ON amenities(society_id);
CREATE INDEX IF NOT EXISTS idx_amenity_bookings_society_id ON amenity_bookings(society_id);
