"""
One-time script to seed the default admin account.
Run from the backend directory: python -m app.seed_admin
"""
import sys
from pathlib import Path

# Ensure backend dir is in sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.db.supabase import db_service
from app.core.auth_utils import hash_password

DEFAULT_SOCIETY_ID = "d3b07384-d113-4c4e-9c8e-aa98350d1234"
DEFAULT_EMAIL = "admin@hamsayaa.com"
DEFAULT_PASSWORD = "admin123"
DEFAULT_NAME = "System Administrator"

def seed():
    print(f"\n🔐 Hamsayaa Admin Seeder")
    print(f"{'='*40}")

    # Check if admin already exists
    existing = db_service.get_admin_by_email(DEFAULT_EMAIL)
    if existing:
        print(f"✅ Admin '{DEFAULT_EMAIL}' already exists (ID: {existing['id']}). Skipping.")
        return

    admin_data = {
        "society_id": DEFAULT_SOCIETY_ID,
        "name": DEFAULT_NAME,
        "email": DEFAULT_EMAIL,
        "password_hash": hash_password(DEFAULT_PASSWORD),
        "phone": "+923001234567",
        "role": "super_admin",
        "is_active": True,
    }
    created = db_service.create_admin(admin_data)
    if created:
        print(f"✅ Default admin created successfully!")
        print(f"   Email:    {DEFAULT_EMAIL}")
        print(f"   Password: {DEFAULT_PASSWORD}")
        print(f"   Role:     super_admin")
        print(f"   ID:       {created.get('id')}")
        print(f"\n⚠️  Change this password immediately after first login!")
    else:
        print(f"❌ Failed to create admin. Check Supabase connection.")

if __name__ == "__main__":
    seed()
