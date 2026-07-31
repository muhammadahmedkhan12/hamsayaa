import httpx
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

class WhatsAppService:
    def __init__(self):
        self.access_token = settings.WHATSAPP_ACCESS_TOKEN
        self.app_id = settings.WHATSAPP_APP_ID
        self.test_number = settings.WHATSAPP_TEST_NUMBER
        self.phone_number_id = settings.WHATSAPP_PHONE_NUMBER_ID or "1229806946879920"
        self.base_url = "https://graph.facebook.com/v18.0"

    async def send_text_message(self, recipient_phone: str, message_text: str) -> dict:
        """
        Dispatches outbound text message to resident via Meta WhatsApp Cloud API.
        """
        token = settings.WHATSAPP_ACCESS_TOKEN
        phone_id = settings.WHATSAPP_PHONE_NUMBER_ID or "1229806946879920"

        if not token:
            logger.warning(f"Simulating WhatsApp text dispatch to {recipient_phone}: {message_text}")
            return {"status": "simulated", "recipient": recipient_phone, "text": message_text}

        url = f"{self.base_url}/{phone_id}/messages"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        # Clean phone number string
        clean_phone = recipient_phone.replace("+", "").replace(" ", "").replace("-", "")
        
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": clean_phone,
            "type": "text",
            "text": {
                "preview_url": False,
                "body": message_text
            }
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(url, headers=headers, json=payload, timeout=10.0)
                logger.info(f"WhatsApp API response: {response.status_code}")
                return response.json()
            except Exception as e:
                logger.error(f"Error sending WhatsApp message: {e}")
                return {"status": "error", "message": str(e)}

    async def send_media_message(self, recipient_phone: str, media_url: str, caption: str = "") -> dict:
        """
        Dispatches visitor pass PDF/image to resident via Meta WhatsApp Cloud API.
        """
        if not self.access_token:
            logger.warning(f"Simulating WhatsApp media dispatch to {recipient_phone}: {media_url}")
            return {"status": "simulated", "recipient": recipient_phone, "media_url": media_url}

        url = f"{self.base_url}/{self.phone_number_id}/messages"
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json"
        }
        clean_phone = recipient_phone.replace("+", "").replace(" ", "").replace("-", "")
        
        payload = {
            "messaging_product": "whatsapp",
            "to": clean_phone,
            "type": "image",
            "image": {
                "link": media_url,
                "caption": caption
            }
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(url, headers=headers, json=payload, timeout=10.0)
                return response.json()
            except Exception as e:
                logger.error(f"Error sending WhatsApp media: {e}")
                return {"status": "error", "message": str(e)}

    async def download_media(self, media_id: str) -> bytes:
        """
        Fetches media URL from Meta Graph API for a given media_id,
        then downloads and returns the raw binary audio/media bytes.
        """
        token = settings.WHATSAPP_ACCESS_TOKEN
        if not token or not media_id:
            logger.warning(f"No access token or media ID provided for media download: {media_id}")
            return b""

        headers = {"Authorization": f"Bearer {token}"}
        url = f"{self.base_url}/{media_id}"

        async with httpx.AsyncClient() as client:
            try:
                res = await client.get(url, headers=headers, timeout=10.0)
                if res.status_code != 200:
                    logger.error(f"Meta Graph API error fetching media URL: {res.status_code} - {res.text}")
                    return b""
                
                media_info = res.json()
                download_url = media_info.get("url")
                if not download_url:
                    logger.error(f"No URL returned for media ID {media_id}")
                    return b""

                media_res = await client.get(download_url, headers=headers, timeout=15.0)
                if media_res.status_code == 200:
                    logger.info(f"Successfully downloaded {len(media_res.content)} bytes for media ID {media_id}")
                    return media_res.content
                else:
                    logger.error(f"Failed downloading media binary: {media_res.status_code}")
                    return b""
            except Exception as e:
                logger.error(f"Exception downloading WhatsApp media {media_id}: {e}")
                return b""

whatsapp_service = WhatsAppService()
