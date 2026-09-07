from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from app.db.supabase import db_service
from app.core.auth_utils import hash_password, verify_password, create_access_token, decode_access_token
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

DEFAULT_SOCIETY_ID = "d3b07384-d113-4c4e-9c8e-aa98350d1234"


class LoginRequest(BaseModel):
    email: str
    password: str


class AdminCreateRequest(BaseModel):
    name: str
    email: str
    password: str
    phone: str = ""
    role: str = "admin"


class AdminUpdateRequest(BaseModel):
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    role: str | None = None
    is_active: bool | None = None
    password: str | None = None


def _get_current_admin(request: Request) -> dict:
    """Extract and validate the Bearer token from request headers."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    token = auth_header.split(" ", 1)[1]
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    admin = db_service.get_admin_by_id(payload.get("sub"))
    if not admin or not admin.get("is_active"):
        raise HTTPException(status_code=401, detail="Admin account not found or deactivated")
    return admin


@router.post("/login")
async def login(body: LoginRequest):
    """Authenticate admin with email and password, return JWT token."""
    admin = db_service.get_admin_by_email(body.email)
    if not admin:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not admin.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account is deactivated. Contact your administrator.")
    if not verify_password(body.password, admin.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Update last login timestamp
    db_service.update_admin_last_login(admin["id"])

    token = create_access_token(admin["id"], admin["email"])
    return {
        "status": "success",
        "token": token,
        "admin": {
            "id": admin["id"],
            "name": admin["name"],
            "email": admin["email"],
            "phone": admin.get("phone"),
            "role": admin.get("role", "admin"),
            "society_id": admin.get("society_id"),
        }
    }


@router.get("/me")
async def get_current_admin(request: Request):
    """Return the currently authenticated admin's profile."""
    admin = _get_current_admin(request)
    return {
        "status": "success",
        "admin": admin
    }


@router.get("/admins")
async def list_admins(request: Request, society_id: str = DEFAULT_SOCIETY_ID):
    """List all admin users for a society."""
    _get_current_admin(request)  # Require auth
    admins = db_service.get_admins(society_id)
    return {"status": "success", "admins": admins}


@router.post("/admins")
async def create_admin(body: AdminCreateRequest, request: Request, society_id: str = DEFAULT_SOCIETY_ID):
    """Create a new admin user."""
    _get_current_admin(request)  # Require auth

    # Check for duplicate email
    existing = db_service.get_admin_by_email(body.email)
    if existing:
        raise HTTPException(status_code=409, detail="An admin with this email already exists")

    admin_data = {
        "society_id": society_id,
        "name": body.name,
        "email": body.email.lower().strip(),
        "password_hash": hash_password(body.password),
        "phone": body.phone,
        "role": body.role,
        "is_active": True,
    }
    created = db_service.create_admin(admin_data)
    if not created:
        raise HTTPException(status_code=500, detail="Failed to create admin")

    # Return admin profile without password_hash
    safe_admin = {k: v for k, v in created.items() if k != "password_hash"}
    return {"status": "success", "admin": safe_admin}


@router.patch("/admins/{admin_id}")
async def update_admin(admin_id: str, body: AdminUpdateRequest, request: Request):
    """Update an existing admin user."""
    _get_current_admin(request)  # Require auth

    update_data = {}
    if body.name is not None:
        update_data["name"] = body.name
    if body.email is not None:
        # Check for duplicate email
        existing = db_service.get_admin_by_email(body.email)
        if existing and existing["id"] != admin_id:
            raise HTTPException(status_code=409, detail="An admin with this email already exists")
        update_data["email"] = body.email
    if body.phone is not None:
        update_data["phone"] = body.phone
    if body.role is not None:
        update_data["role"] = body.role
    if body.is_active is not None:
        update_data["is_active"] = body.is_active
    if body.password is not None and body.password.strip():
        update_data["password_hash"] = hash_password(body.password)

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    updated = db_service.update_admin(admin_id, update_data)
    if not updated:
        raise HTTPException(status_code=404, detail="Admin not found")

    safe_updated = {k: v for k, v in updated.items() if k != "password_hash"}
    return {"status": "success", "admin": safe_updated}


@router.delete("/admins/{admin_id}")
async def delete_admin(admin_id: str, request: Request):
    """Delete an admin user."""
    current = _get_current_admin(request)
    if current["id"] == admin_id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")

    success = db_service.delete_admin(admin_id)
    if not success:
        raise HTTPException(status_code=404, detail="Admin not found or could not be deleted")
    return {"status": "success", "message": "Admin deleted"}
