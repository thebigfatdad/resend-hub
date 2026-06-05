"""Resend inbound webhook route."""
from __future__ import annotations

import json
import logging
import os

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.config import get_settings
from app.deps import (
    BrandRepoDep,
    CustomerRepoDep,
    ResendClientDep,
    ThreadRepoDep,
)
from app.services.inbound import process_inbound_email

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/resend/inbound", status_code=200)
async def resend_inbound(
    request: Request,
    brand_repo: BrandRepoDep,
    customer_repo: CustomerRepoDep,
    thread_repo: ThreadRepoDep,
    resend_client: ResendClientDep,
) -> dict:
    """
    Process inbound email webhook from Resend.

    Steps:
    1. Read raw body bytes (needed for Svix verification)
    2. Extract Svix headers
    3. Resolve brand from `to` address in the raw payload
    4. Look up the brand's webhook secret from env
    5. Verify Svix signature — 401 if invalid
    6. Fetch full email via resend.Emails.Receiving.get(email_id)
    7. Upsert customer, resolve/create thread, persist message, enqueue task
    8. Return 200 immediately
    """
    # Step 1: Read raw body
    body_bytes = await request.body()

    # Step 2: Extract Svix headers
    svix_id = request.headers.get("svix-id")
    svix_timestamp = request.headers.get("svix-timestamp")
    svix_signature = request.headers.get("svix-signature")

    if not (svix_id and svix_timestamp and svix_signature):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Svix signature headers",
        )

    # Step 3: Resolve brand from `to` address in raw payload
    try:
        payload = json.loads(body_bytes)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid JSON payload",
        )

    try:
        to_address = payload["data"]["to"][0]
    except (KeyError, IndexError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Cannot extract 'to' address from payload",
        )

    brand = brand_repo.get_by_support_email(to_address)
    if brand is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"No brand found for address: {to_address}",
        )

    # Step 4: Look up the brand's webhook secret
    settings = get_settings()
    secret = settings.get_webhook_secret(brand.resend.webhookSecretRef)
    if not secret:
        logger.error(
            "Webhook secret not configured for brand",
            extra={"brand_id": brand.id, "secret_ref": brand.resend.webhookSecretRef},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Webhook secret not configured",
        )

    # Step 5: Verify Svix signature
    from svix.webhooks import Webhook, WebhookVerificationError

    try:
        wh = Webhook(secret)
        wh.verify(
            body_bytes,
            {
                "svix-id": svix_id,
                "svix-timestamp": svix_timestamp,
                "svix-signature": svix_signature,
            },
        )
    except WebhookVerificationError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Svix signature",
        )

    # Step 6: Fetch full email body via Resend
    email_id = payload["data"]["email_id"]
    try:
        received_email = resend_client.get_received(email_id)
    except Exception as exc:
        logger.error("Failed to fetch email from Resend", extra={"email_id": email_id, "error": str(exc)})
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to retrieve email content from Resend",
        )

    # Step 7: Process inbound email
    result = process_inbound_email(
        brand_id=brand.id,
        received_email=received_email,
        brand_repo=brand_repo,
        customer_repo=customer_repo,
        thread_repo=thread_repo,
    )

    logger.info(
        "Inbound email processed",
        extra={
            "brand_id": brand.id,
            "thread_id": result["thread_id"],
            "message_id": result["message_id"],
        },
    )

    # Step 8: Return 200 immediately
    return {
        "ok": True,
        "threadId": result["thread_id"],
        "messageId": result["message_id"],
        "customerId": result["customer_id"],
        "taskId": result["task_id"],
    }
