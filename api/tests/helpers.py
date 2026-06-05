"""Test helpers — Svix header generation and fake data factories."""
from __future__ import annotations

import base64
import hashlib
import hmac
import time
import uuid


def generate_svix_headers(payload_bytes: bytes, secret: str) -> dict:
    """
    Produce valid Svix webhook headers matching what the real Svix library sends.

    Secret format: whsec_<base64>
    Signed content: {svix-id}.{svix-timestamp}.{payload_str}
    Algorithm: HMAC-SHA256 of signed content, base64-encoded
    Signature header: v1,{base64_sig}
    """
    # Decode the secret — strip the "whsec_" prefix and base64-decode
    if secret.startswith("whsec_"):
        raw_secret = base64.b64decode(secret[len("whsec_"):])
    else:
        raw_secret = base64.b64decode(secret)

    msg_id = f"msg_{uuid.uuid4().hex}"
    timestamp = str(int(time.time()))

    # Build the signed content string
    payload_str = payload_bytes.decode("utf-8")
    signed_content = f"{msg_id}.{timestamp}.{payload_str}"

    # HMAC-SHA256
    sig = hmac.new(raw_secret, signed_content.encode("utf-8"), hashlib.sha256).digest()
    sig_b64 = base64.b64encode(sig).decode("utf-8")

    return {
        "svix-id": msg_id,
        "svix-timestamp": timestamp,
        "svix-signature": f"v1,{sig_b64}",
    }
