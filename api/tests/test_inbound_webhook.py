"""Tests for POST /webhooks/resend/inbound."""
from __future__ import annotations

import json
import os
import uuid
from unittest.mock import MagicMock, patch

import pytest

from tests.conftest import (
    TEST_WEBHOOK_SECRET,
    TRUSTMATCH_SECRET_ENV_VAR,
    make_fake_received_email,
    make_webhook_payload,
)
from tests.helpers import generate_svix_headers


# ---------------------------------------------------------------------------
# Helper: post a signed webhook
# ---------------------------------------------------------------------------

def post_signed_webhook(
    client,
    payload_bytes: bytes,
    secret: str = TEST_WEBHOOK_SECRET,
    extra_headers: dict | None = None,
    mock_resend_client=None,
    received_email=None,
):
    svix_headers = generate_svix_headers(payload_bytes, secret)
    headers = {**svix_headers, "content-type": "application/json"}
    if extra_headers:
        headers.update(extra_headers)

    if mock_resend_client is not None and received_email is not None:
        mock_resend_client.get_received.return_value = received_email

    return client.post("/webhooks/resend/inbound", content=payload_bytes, headers=headers)


# ---------------------------------------------------------------------------
# test_invalid_signature_rejected
# ---------------------------------------------------------------------------

def test_invalid_signature_rejected(client, mock_resend_client):
    """A webhook signed with the wrong secret must return 401."""
    payload = make_webhook_payload()
    wrong_secret = "whsec_d3JvbmdzZWNyZXRrZXlmb3J0ZXN0aW5nMQ=="  # different secret

    svix_headers = generate_svix_headers(payload, wrong_secret)
    headers = {**svix_headers, "content-type": "application/json"}

    response = client.post("/webhooks/resend/inbound", content=payload, headers=headers)
    assert response.status_code == 401


# ---------------------------------------------------------------------------
# test_missing_svix_headers_rejected
# ---------------------------------------------------------------------------

def test_missing_svix_headers_rejected(client):
    """A request without Svix headers must return 401."""
    payload = make_webhook_payload()
    response = client.post(
        "/webhooks/resend/inbound",
        content=payload,
        headers={"content-type": "application/json"},
    )
    assert response.status_code == 401


# ---------------------------------------------------------------------------
# test_new_email_creates_thread_and_customer
# ---------------------------------------------------------------------------

def test_new_email_creates_thread_and_customer(
    client, brand_repo, customer_repo, thread_repo, mock_resend_client
):
    """
    A valid signed webhook for a new sender creates a customer,
    creates a thread with status 'awaiting_human', and persists the message.
    """
    email_id = "email_new_sender_001"
    received = make_fake_received_email(
        email_id=email_id,
        from_field="Bob Newcustomer <bob@newcustomer.com>",
        to=["support@hey.trustmatch.io"],
        subject="I need help",
        text="Please help me with my account.",
    )
    mock_resend_client.get_received.return_value = received

    payload = make_webhook_payload(email_id=email_id, to="support@hey.trustmatch.io")
    response = post_signed_webhook(client, payload)

    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is True

    thread_id = data["threadId"]
    customer_id = data["customerId"]

    # Customer was created
    import hashlib
    expected_cid = hashlib.sha256("bob@newcustomer.com".encode()).hexdigest()
    assert customer_id == expected_cid
    customer = customer_repo.get("trustmatch", customer_id)
    assert customer is not None
    assert customer.email == "bob@newcustomer.com"

    # Thread was created with awaiting_human status
    thread = thread_repo.get(thread_id)
    assert thread is not None
    assert thread.status.value == "awaiting_human"
    assert thread.brandId == "trustmatch"
    assert thread.customerId == customer_id

    # Message was persisted
    messages = thread_repo.get_messages(thread_id)
    assert len(messages) == 1
    msg = messages[0]
    assert msg.direction == "inbound"
    assert msg.subject == "I need help"


# ---------------------------------------------------------------------------
# test_reply_email_appends_to_thread
# ---------------------------------------------------------------------------

def test_reply_email_appends_to_thread(
    client, brand_repo, customer_repo, thread_repo, mock_resend_client
):
    """
    A second email with In-Reply-To matching the first thread's rootMessageId
    appends to the same thread and does not create a new thread.
    """
    # First email
    first_msg_id = f"<first-{uuid.uuid4().hex}@example.com>"
    first_received = make_fake_received_email(
        email_id="email_first",
        from_field="Carol <carol@example.com>",
        subject="My question",
        message_id=first_msg_id,
    )
    mock_resend_client.get_received.return_value = first_received

    payload1 = make_webhook_payload(email_id="email_first")
    r1 = post_signed_webhook(client, payload1)
    assert r1.status_code == 200
    thread_id = r1.json()["threadId"]

    # Verify thread has 1 message
    assert len(thread_repo.get_messages(thread_id)) == 1

    # Second email: reply with In-Reply-To
    second_msg_id = f"<second-{uuid.uuid4().hex}@example.com>"
    second_received = make_fake_received_email(
        email_id="email_second",
        from_field="Carol <carol@example.com>",
        subject="My question",
        message_id=second_msg_id,
        in_reply_to=first_msg_id,
        references=first_msg_id,
    )
    mock_resend_client.get_received.return_value = second_received

    payload2 = make_webhook_payload(email_id="email_second")
    r2 = post_signed_webhook(client, payload2)
    assert r2.status_code == 200

    # Must be the same thread
    assert r2.json()["threadId"] == thread_id

    # Thread now has 2 messages
    assert len(thread_repo.get_messages(thread_id)) == 2

    # No new thread was created
    all_threads = thread_repo.list()
    assert len(all_threads) == 1


# ---------------------------------------------------------------------------
# test_unknown_brand_returns_422
# ---------------------------------------------------------------------------

def test_unknown_brand_returns_422(client, mock_resend_client):
    """
    A webhook whose `to` address doesn't match any brand must return 422.
    """
    payload = make_webhook_payload(to="support@unknown-brand.com")
    response = post_signed_webhook(client, payload)
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# test_subject_fallback_threading
# ---------------------------------------------------------------------------

def test_subject_fallback_threading(
    client, brand_repo, customer_repo, thread_repo, mock_resend_client
):
    """
    Without In-Reply-To, but same subject + same customer → appends to same thread.
    """
    subject = "Repeated question"
    sender = "dave@example.com"
    from_field = f"Dave <{sender}>"

    # First email — no threading headers
    first_received = make_fake_received_email(
        email_id="email_sub1",
        from_field=from_field,
        subject=subject,
        message_id=f"<sub1-{uuid.uuid4().hex}@example.com>",
    )
    mock_resend_client.get_received.return_value = first_received
    payload1 = make_webhook_payload(email_id="email_sub1")
    r1 = post_signed_webhook(client, payload1)
    assert r1.status_code == 200
    thread_id = r1.json()["threadId"]

    # Second email — same subject, same sender, no In-Reply-To
    second_received = make_fake_received_email(
        email_id="email_sub2",
        from_field=from_field,
        subject=subject,
        message_id=f"<sub2-{uuid.uuid4().hex}@example.com>",
        in_reply_to=None,
        references=None,
    )
    mock_resend_client.get_received.return_value = second_received
    payload2 = make_webhook_payload(email_id="email_sub2")
    r2 = post_signed_webhook(client, payload2)
    assert r2.status_code == 200

    # Same thread
    assert r2.json()["threadId"] == thread_id

    # 2 messages in the thread
    assert len(thread_repo.get_messages(thread_id)) == 2

    # Only 1 thread in total
    assert len(thread_repo.list()) == 1
