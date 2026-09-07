"""
Creates the admins table in Supabase and seeds the default admin.
Run from the backend directory: python -m app.setup_admins
"""
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.core.config import settings


def create_table():
    """Check if admins table exists, guide user to create it if not."""
    from app.db.supabase import db_service
    
    print("[*] Checking if 'admins' table exists...")
    
    try:
        res = db_service.client.table("admins").select("id").limit(1).execute()
        print("[OK] 'admins' table already exists!")
        return True
    except Exception as e:
        error_str = str(e)
        if "does not exist" in error_str or "42P01" in error_str:
            print("[!!] 'admins' table does not exist yet.")
            print("")
            print("Please create it in Supabase Dashboard -> SQL Editor:")
            print("")
            print("CREATE TABLE IF NOT EXISTS admins (")
            print("    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),")
            print("    society_id UUID REFERENCES societies(id),")
            print("    name TEXT NOT NULL,")
            print("    email TEXT NOT NULL UNIQUE,")
            print("    password_hash TEXT NOT NULL,")
            print("    phone TEXT,")
            print("    role TEXT NOT NULL DEFAULT 'admin',")
            print("    is_active BOOLEAN DEFAULT true,")
            print("    created_at TIMESTAMPTZ DEFAULT now(),")
            print("    last_login_at TIMESTAMPTZ")
            print(");")
            return False
        else:
            print(f"[WARN] Response: {e}")
            print("  Attempting to proceed anyway...")
            return True


def seed_admin():
    """Seed the default admin account."""
    from app.db.supabase import db_service
    from app.core.auth_utils import hash_password
    
    DEFAULT_SOCIETY_ID = "d3b07384-d113-4c4e-9c8e-aa98350d1234"
    DEFAULT_EMAIL = "admin@hamsayaa.com"
    DEFAULT_PASSWORD = "admin123"
    
    existing = db_service.get_admin_by_email(DEFAULT_EMAIL)
    if existing:
        print(f"[OK] Admin '{DEFAULT_EMAIL}' already exists (ID: {existing['id']}). Skipping.")
        return
    
    admin_data = {
        "society_id": DEFAULT_SOCIETY_ID,
        "name": "System Administrator",
        "email": DEFAULT_EMAIL,
        "password_hash": hash_password(DEFAULT_PASSWORD),
        "phone": "+923001234567",
        "role": "super_admin",
        "is_active": True,
    }
    created = db_service.create_admin(admin_data)
    if created:
        print(f"[OK] Default admin created!")
        print(f"   Email:    {DEFAULT_EMAIL}")
        print(f"   Password: {DEFAULT_PASSWORD}")
        print(f"   ID:       {created.get('id')}")
    else:
        print("[FAIL] Failed to create admin.")


if __name__ == "__main__":
    print("\n[ADMIN SETUP] Hamsayaa Admin Setup")
    print("=" * 40)
    table_ok = create_table()
    if table_ok:
        print("\n[*] Seeding default admin...")
        seed_admin()
    print("\n[DONE] Setup complete!")
