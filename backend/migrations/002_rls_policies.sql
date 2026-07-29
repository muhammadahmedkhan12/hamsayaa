-- Hamsayaa Row-Level Security (RLS) Migration v1.4
-- Enforces tenant isolation so authenticated admins can only access records matching their society_id.

-- 1. Helper function to extract society_id for currently authenticated admin user
CREATE OR REPLACE FUNCTION get_auth_society_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS '
    SELECT society_id FROM users WHERE id = auth.uid();
';

-- 2. Enable RLS across all tenant tables
ALTER TABLE societies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE registered_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE society_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitor_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE amenities ENABLE ROW LEVEL SECURITY;
ALTER TABLE amenity_bookings ENABLE ROW LEVEL SECURITY;

-- 3. Define Row-Level Security Policies for Authenticated Admin Users

-- Societies Policy
CREATE POLICY admin_societies_isolation ON societies
    FOR ALL TO authenticated
    USING (id = get_auth_society_id())
    WITH CHECK (id = get_auth_society_id());

-- Users Policy
CREATE POLICY admin_users_isolation ON users
    FOR ALL TO authenticated
    USING (society_id = get_auth_society_id())
    WITH CHECK (society_id = get_auth_society_id());

-- Residents Policy
CREATE POLICY admin_residents_isolation ON residents
    FOR ALL TO authenticated
    USING (society_id = get_auth_society_id())
    WITH CHECK (society_id = get_auth_society_id());

-- Registered Vehicles Policy
CREATE POLICY admin_registered_vehicles_isolation ON registered_vehicles
    FOR ALL TO authenticated
    USING (society_id = get_auth_society_id())
    WITH CHECK (society_id = get_auth_society_id());

-- Invoices Policy
CREATE POLICY admin_invoices_isolation ON invoices
    FOR ALL TO authenticated
    USING (society_id = get_auth_society_id())
    WITH CHECK (society_id = get_auth_society_id());

-- Society Bills Policy
CREATE POLICY admin_society_bills_isolation ON society_bills
    FOR ALL TO authenticated
    USING (society_id = get_auth_society_id())
    WITH CHECK (society_id = get_auth_society_id());

-- Complaints Policy
CREATE POLICY admin_complaints_isolation ON complaints
    FOR ALL TO authenticated
    USING (society_id = get_auth_society_id())
    WITH CHECK (society_id = get_auth_society_id());

-- Visitor Passes Policy
CREATE POLICY admin_visitor_passes_isolation ON visitor_passes
    FOR ALL TO authenticated
    USING (society_id = get_auth_society_id())
    WITH CHECK (society_id = get_auth_society_id());

-- Vehicle Logs Policy
CREATE POLICY admin_vehicle_logs_isolation ON vehicle_logs
    FOR ALL TO authenticated
    USING (society_id = get_auth_society_id())
    WITH CHECK (society_id = get_auth_society_id());

-- Polls Policy
CREATE POLICY admin_polls_isolation ON polls
    FOR ALL TO authenticated
    USING (society_id = get_auth_society_id())
    WITH CHECK (society_id = get_auth_society_id());

-- Poll Votes Policy
CREATE POLICY admin_poll_votes_isolation ON poll_votes
    FOR ALL TO authenticated
    USING (society_id = (SELECT society_id FROM polls WHERE id = poll_id))
    WITH CHECK (society_id = (SELECT society_id FROM polls WHERE id = poll_id));

-- Expenses Policy
CREATE POLICY admin_expenses_isolation ON expenses
    FOR ALL TO authenticated
    USING (society_id = get_auth_society_id())
    WITH CHECK (society_id = get_auth_society_id());

-- Employees Policy
CREATE POLICY admin_employees_isolation ON employees
    FOR ALL TO authenticated
    USING (society_id = get_auth_society_id())
    WITH CHECK (society_id = get_auth_society_id());

-- Assets Policy
CREATE POLICY admin_assets_isolation ON assets
    FOR ALL TO authenticated
    USING (society_id = get_auth_society_id())
    WITH CHECK (society_id = get_auth_society_id());

-- Maintenance Logs Policy
CREATE POLICY admin_maintenance_logs_isolation ON maintenance_logs
    FOR ALL TO authenticated
    USING (society_id = get_auth_society_id())
    WITH CHECK (society_id = get_auth_society_id());

-- Amenities Policy
CREATE POLICY admin_amenities_isolation ON amenities
    FOR ALL TO authenticated
    USING (society_id = get_auth_society_id())
    WITH CHECK (society_id = get_auth_society_id());

-- Amenity Bookings Policy
CREATE POLICY admin_amenity_bookings_isolation ON amenity_bookings
    FOR ALL TO authenticated
    USING (society_id = get_auth_society_id())
    WITH CHECK (society_id = get_auth_society_id());
