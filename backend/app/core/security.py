import hmac
import hashlib
from fastapi import HTTPException, Security, status
from fastapi.security import APIKeyHeader
from app.core.config import settings

X_HUB_SIGNATURE_256 = APIKeyHeader(name="X-Hub-Signature-256", auto_error=False)

def verify_whatsapp_signature(payload_bytes: bytes, signature_header: str | None) -> bool:
    """
    Validates inbound Meta WhatsApp Cloud API webhooks using HMAC SHA-256 with Meta App Secret.
    """
    if not settings.WHATSAPP_APP_SECRET:
        return True  # Bypass in dev mode if secret not configured
        
    if not signature_header or not signature_header.startswith("sha256="):
        return False
        
    expected_signature = signature_header.split("sha256=")[1]
    calculated = hmac.new(
        key=settings.WHATSAPP_APP_SECRET.encode("utf-8"),
        msg=payload_bytes,
        digestmod=hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(calculated, expected_signature)
