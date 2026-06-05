"""Outbound email service — reply and transactional sends."""
from __future__ import annotations

import logging
import uuid
from datetime import datetime
from typing import Any

from app.models.domain import Message, MessageAI, MessageHeaders, Thread
from app.repos.base import BrandRepo, CustomerRepo, ThreadRepo

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Transactional templates
# ---------------------------------------------------------------------------

TEMPLATES: dict[str, dict[str, str]] = {
    "verification_success": {
        "subject": "Your email has been verified",
        "text": "Hi {name},\n\nYour email address has been verified successfully.\n\nWelcome to {app_name}!\n\nThe {app_name} Team",
        "html": "<p>Hi {name},</p><p>Your email address has been verified successfully.</p><p>Welcome to {app_name}!</p><p>The {app_name} Team</p>",
    },
    "password_reset": {
        "subject": "Reset your password",
        "text": "Hi {name},\n\nWe received a request to reset your password. Click the link below:\n\n{reset_link}\n\nThis link expires in {expiry}.\n\nIf you did not request this, please ignore this email.\n\nThe {app_name} Team",
        "html": "<p>Hi {name},</p><p>We received a request to reset your password. Click the link below:</p><p><a href=\"{reset_link}\">{reset_link}</a></p><p>This link expires in {expiry}.</p><p>If you did not request this, please ignore this email.</p><p>The {app_name} Team</p>",
    },
    "receipt": {
        "subject": "Your receipt for {order_id}",
        "text": "Hi {name},\n\nThank you for your purchase!\n\nOrder ID: {order_id}\nAmount: {amount}\nDate: {date}\n\nThe {app_name} Team",
        "html": "<p>Hi {name},</p><p>Thank you for your purchase!</p><table><tr><td>Order ID:</td><td>{order_id}</td></tr><tr><td>Amount:</td><td>{amount}</td></tr><tr><td>Date:</td><td>{date}</td></tr></table><p>The {app_name} Team</p>",
    },
}


def _render_template(template_str: str, vars: dict[str, Any]) -> str:
    """Substitute vars into a template string using str.format_map."""
    try:
        return template_str.format_map(vars)
    except KeyError:
        # Return template with available vars substituted, leave missing as-is
        import string
        formatter = string.Formatter()
        result = []
        for literal, field_name, format_spec, conversion in formatter.parse(template_str):
            result.append(literal)
            if field_name is not None:
                value = vars.get(field_name, "{" + field_name + "}")
                result.append(str(value))
        return "".join(result)


def send_thread_reply(
    *,
    thread: Thread,
    body: str,
    brand_repo: BrandRepo,
    customer_repo: CustomerRepo,
    thread_repo: ThreadRepo,
    resend_client,
) -> dict:
    """
    Send a reply to a thread via Resend with correct RFC threading headers.
    Returns dict with messageId and resendId.
    """
    now = datetime.utcnow()

    brand = brand_repo.get(thread.brandId)
    if brand is None:
        raise ValueError(f"Brand {thread.brandId} not found")

    customer = customer_repo.get(thread.brandId, thread.customerId)
    if customer is None:
        raise ValueError(f"Customer {thread.customerId} not found in brand {thread.brandId}")

    # Generate new RFC Message-ID
    new_message_id = f"<{uuid.uuid4().hex}@{brand.domains.supportSubdomain}>"

    # Build References header: chain of existing references + rootMessageId
    root = thread.rfc.rootMessageId
    existing_refs = thread.rfc.references

    if existing_refs:
        references_header = " ".join(existing_refs + [root])
    else:
        references_header = root

    # Build HTML wrapper for the body
    html_body = _markdown_to_simple_html(body)

    send_params = {
        "from": brand.senders.support,
        "to": [customer.email],
        "subject": thread.subject,
        "html": html_body,
        "text": body,
        "headers": {
            "Message-ID": new_message_id,
            "In-Reply-To": root,
            "References": references_header,
        },
    }

    response = resend_client.send(send_params)
    resend_id = response.get("id") if isinstance(response, dict) else getattr(response, "id", None)

    # Persist outbound message
    msg_id = uuid.uuid4().hex
    message = Message.model_validate({
        "id": msg_id,
        "threadId": thread.id,
        "direction": "outbound",
        "from": brand.senders.support,
        "to": [customer.email],
        "subject": thread.subject,
        "bodyText": body,
        "bodyHtml": html_body,
        "attachments": [],
        "headers": {
            "messageId": new_message_id,
            "inReplyTo": root,
            "references": existing_refs + [root] if existing_refs else [root],
        },
        "ai": {},
        "sentVia": "resend",
        "resendId": resend_id,
        "createdAt": now,
    })
    thread_repo.add_message(thread.id, message)

    # Update thread
    new_status = "open" if thread.status.value == "awaiting_human" else thread.status.value
    thread_repo.update(
        thread.id,
        {
            "lastOutboundAt": now,
            "updatedAt": now,
            "status": new_status,
        },
    )

    return {
        "messageId": new_message_id,
        "resendId": resend_id,
    }


def send_transactional(
    *,
    brand_id: str,
    template: str,
    to: str,
    vars: dict[str, Any],
    brand_repo: BrandRepo,
    resend_client,
) -> dict:
    """
    Send a transactional email from brand.senders.noReply.
    Returns dict with id (Resend ID).
    """
    brand = brand_repo.get(brand_id)
    if brand is None:
        raise ValueError(f"Brand {brand_id} not found")
    if brand.status != "active":
        raise ValueError(f"Brand {brand_id} is not active")

    tmpl = TEMPLATES.get(template)
    if tmpl is None:
        raise KeyError(f"Unknown template: {template}")

    subject = _render_template(tmpl["subject"], vars)
    text_body = _render_template(tmpl["text"], vars)
    html_body = _render_template(tmpl["html"], vars)

    send_params = {
        "from": brand.senders.noReply,
        "to": [to],
        "subject": subject,
        "html": html_body,
        "text": text_body,
    }

    response = resend_client.send(send_params)
    resend_id = response.get("id") if isinstance(response, dict) else getattr(response, "id", None)

    return {"id": resend_id}


def _markdown_to_simple_html(text: str) -> str:
    """Convert plain text / simple markdown-ish to basic HTML."""
    import html as html_mod

    lines = text.split("\n")
    html_lines = []
    for line in lines:
        escaped = html_mod.escape(line)
        if escaped.strip():
            html_lines.append(f"<p>{escaped}</p>")
        else:
            html_lines.append("<br>")
    return "\n".join(html_lines)
