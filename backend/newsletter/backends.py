"""Django email backend that posts to the Resend HTTP API.

SMTP would also work (Resend speaks it), but some hosts block outbound SMTP
ports, and going over HTTPS keeps sending working anywhere the app can already
reach the internet. Everything else in the app still uses django.core.mail, so
swapping providers means writing another backend, not touching call sites.
"""

import httpx
from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend

API_URL = "https://api.resend.com/emails"


class ResendEmailBackend(BaseEmailBackend):
    def __init__(self, fail_silently=False, **kwargs):
        super().__init__(fail_silently=fail_silently, **kwargs)
        self.api_key = getattr(settings, "RESEND_API_KEY", "")

    def send_messages(self, email_messages):
        if not email_messages:
            return 0
        if not self.api_key:
            if self.fail_silently:
                return 0
            raise RuntimeError("RESEND_API_KEY is not set")

        sent = 0
        with httpx.Client(timeout=30) as client:
            for message in email_messages:
                try:
                    self._send(client, message)
                except Exception:
                    if not self.fail_silently:
                        raise
                else:
                    sent += 1
        return sent

    def _send(self, client, message):
        payload = {
            "from": message.from_email,
            "to": list(message.to),
            "subject": message.subject,
            "text": message.body,
        }
        if message.cc:
            payload["cc"] = list(message.cc)
        if message.bcc:
            payload["bcc"] = list(message.bcc)
        if message.reply_to:
            payload["reply_to"] = list(message.reply_to)

        for content, mimetype in getattr(message, "alternatives", []):
            if mimetype == "text/html":
                payload["html"] = content

        headers = {k: v for k, v in (message.extra_headers or {}).items()}
        if headers:
            payload["headers"] = headers

        response = client.post(
            API_URL,
            json=payload,
            headers={"Authorization": f"Bearer {self.api_key}"},
        )
        if response.status_code >= 400:
            raise RuntimeError(
                f"Resend rejected the message ({response.status_code}): {response.text}"
            )
