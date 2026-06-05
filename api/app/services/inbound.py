"""Inbound email processing service."""
from __future__ import annotations

import hashlib
import logging
import uuid
from datetime import datetime

from app.models.domain import (
    Customer,
    Message,
    MessageAI,
    MessageAttachment,
    MessageHeaders,
    Thread,
    ThreadRfc,
    ThreadStatus,
)
from app.repos.base import BrandRepo, CustomerRepo, ThreadRepo
from app.services.tasks import enqueue_ai_task

logger = logging.getLogger(__name__)


def customer_id_from_email(email: str) -> str:
    """Compute customerId = sha256(lower(email))."""
    return hashlib.sha256(email.lower().encode()).hexdigest()


def _parse_references(references_header: str | None) -> list[str]:
    """Parse a References header string into a list of message IDs."""
    if not references_header:
        return []
    return [ref.strip() for ref in references_header.split() if ref.strip()]


def process_inbound_email(
    *,
    brand_id: str,
    received_email,  # resend ReceivedEmail object
    brand_repo: BrandRepo,
    customer_repo: CustomerRepo,
    thread_repo: ThreadRepo,
) -> dict:
    """
    Full inbound processing pipeline:
    1. Upsert customer
    2. Resolve or create thread (RFC threading)
    3. Persist message
    4. Enqueue AI task (stub)
    Returns dict with thread_id, message_id, task_id, customer_id.
    """
    now = datetime.utcnow()

    # Extract sender email — `from` field is "Name <email>" or "email"
    from_raw: str = received_email.from_ if hasattr(received_email, "from_") else received_email.from_field
    sender_email = _extract_email_address(from_raw)
    cid = customer_id_from_email(sender_email)

    # --- Upsert customer ---
    customer = customer_repo.get(brand_id, cid)
    if customer is None:
        customer = Customer(
            id=cid,
            brandId=brand_id,
            email=sender_email,
            name=_extract_display_name(from_raw),
            firstSeen=now,
            lastSeen=now,
        )
    else:
        customer.lastSeen = now

    # --- Resolve or create thread ---
    # Extract RFC headers from the received email
    headers_dict: dict[str, str] = {}
    if hasattr(received_email, "headers") and received_email.headers:
        headers_dict = received_email.headers

    in_reply_to: str | None = headers_dict.get("In-Reply-To") or headers_dict.get("in-reply-to")
    references_str: str | None = headers_dict.get("References") or headers_dict.get("references")
    message_id_raw: str | None = (
        headers_dict.get("Message-ID")
        or headers_dict.get("message-id")
        or getattr(received_email, "message_id", None)
    )
    # Normalise: strip angle brackets
    message_id = _strip_angle_brackets(message_id_raw) if message_id_raw else f"<{uuid.uuid4()}@unknown>"
    in_reply_to_clean = _strip_angle_brackets(in_reply_to) if in_reply_to else None
    ref_ids = [_strip_angle_brackets(r) for r in _parse_references(references_str)]

    subject: str = getattr(received_email, "subject", "") or "(no subject)"

    thread: Thread | None = None

    # (1) Match In-Reply-To
    if in_reply_to_clean:
        thread = thread_repo.find_by_rfc(in_reply_to_clean)

    # (2) Match any References header
    if thread is None:
        for ref in ref_ids:
            thread = thread_repo.find_by_rfc(ref)
            if thread is not None:
                break

    # (3) Same subject + same customer
    if thread is None:
        thread = thread_repo.find_by_subject_customer(brand_id, subject, cid)

    # (4) Create new thread
    if thread is None:
        thread_id = uuid.uuid4().hex
        thread = Thread(
            id=thread_id,
            brandId=brand_id,
            customerId=cid,
            subject=subject,
            status=ThreadStatus.awaiting_human,
            rfc=ThreadRfc(
                rootMessageId=message_id,
                references=[],
            ),
            lastInboundAt=now,
            createdAt=now,
            updatedAt=now,
        )
        thread_repo.create(thread)
    else:
        # Update existing thread: append message_id to references, update timestamps
        updated_refs = list(thread.rfc.references)
        if message_id not in updated_refs and message_id != thread.rfc.rootMessageId:
            updated_refs.append(message_id)
        thread_repo.update(
            thread.id,
            {
                "rfc": {
                    "rootMessageId": thread.rfc.rootMessageId,
                    "references": updated_refs,
                },
                "lastInboundAt": now,
                "updatedAt": now,
                "status": ThreadStatus.awaiting_human.value
                if thread.status == ThreadStatus.open
                else thread.status.value,
            },
        )
        thread = thread_repo.get(thread.id)

    # Update customer threadIds
    if thread.id not in customer.threadIds:
        customer.threadIds.append(thread.id)
    customer_repo.upsert(brand_id, customer)

    # --- Build and persist message ---
    to_addresses: list[str] = []
    if hasattr(received_email, "to") and received_email.to:
        if isinstance(received_email.to, list):
            to_addresses = received_email.to
        else:
            to_addresses = [received_email.to]

    attachments: list[MessageAttachment] = []
    if hasattr(received_email, "attachments") and received_email.attachments:
        for att in received_email.attachments:
            att_id = getattr(att, "id", uuid.uuid4().hex)
            attachments.append(
                MessageAttachment(
                    id=att_id,
                    filename=getattr(att, "filename", ""),
                    contentType=getattr(att, "content_type", "application/octet-stream"),
                    size=0,  # Size not provided by Resend metadata; real impl would fetch
                    storagePath=f"attachments/{brand_id}/{thread.id}/{att_id}",
                )
            )

    msg_id = uuid.uuid4().hex
    message = Message.model_validate({
        "id": msg_id,
        "threadId": thread.id,
        "direction": "inbound",
        "from": from_raw,
        "to": to_addresses,
        "subject": subject,
        "bodyText": getattr(received_email, "text", None),
        "bodyHtml": getattr(received_email, "html", None),
        "attachments": [a.model_dump() for a in attachments],
        "headers": {
            "messageId": message_id,
            "inReplyTo": in_reply_to_clean,
            "references": ref_ids,
        },
        "ai": {},
        "sentVia": None,
        "resendId": None,
        "createdAt": now,
    })

    thread_repo.add_message(thread.id, message)

    # --- Enqueue AI task (stub) ---
    task_id = enqueue_ai_task(thread_id=thread.id, message_id=msg_id)

    return {
        "thread_id": thread.id,
        "message_id": msg_id,
        "customer_id": cid,
        "task_id": task_id,
    }


def _extract_email_address(raw: str) -> str:
    """Extract the email address from a 'Name <email>' string."""
    raw = raw.strip()
    if "<" in raw and ">" in raw:
        start = raw.index("<") + 1
        end = raw.index(">")
        return raw[start:end].strip().lower()
    return raw.lower()


def _extract_display_name(raw: str) -> str | None:
    """Extract the display name from a 'Name <email>' string."""
    raw = raw.strip()
    if "<" in raw:
        name = raw[: raw.index("<")].strip().strip('"').strip("'")
        return name if name else None
    return None


def _strip_angle_brackets(s: str) -> str:
    """Strip angle brackets from a message ID."""
    s = s.strip()
    if s.startswith("<") and s.endswith(">"):
        return s[1:-1]
    return s
