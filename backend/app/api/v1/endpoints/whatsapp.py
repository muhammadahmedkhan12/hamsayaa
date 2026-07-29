from fastapi import APIRouter, Request, Response, Query, HTTPException, status
from app.core.config import settings
from app.core.security import verify_whatsapp_signature

router = APIRouter()

@router.get("/webhook")
async def verify_webhook(
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_challenge: str = Query(None, alias="hub.challenge"),
    hub_verify_token: str = Query(None, alias="hub.verify_token")
):
    """
    Meta WhatsApp Cloud API verification handshake endpoint.
    """
    if hub_mode == "subscribe" and hub_verify_token == settings.WHATSAPP_VERIFY_TOKEN:
        return Response(content=hub_challenge, media_type="text/plain")
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Verification token mismatch")

@router.post("/webhook")
async def receive_webhook(request: Request):
    """
    Inbound WhatsApp Cloud API webhook receiver.
    Verifies payload signature and processes resident messages.
    """
    body_bytes = await request.body()
    signature = request.headers.get("X-Hub-Signature-256")
    
    if not verify_whatsapp_signature(body_bytes, signature):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid signature")
        
    payload = await request.json()
    # Webhook payload processing logic will go here
    return {"status": "event_received"}
