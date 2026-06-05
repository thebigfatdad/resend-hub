"""Tests for thread reply and transactional send routes."""
from __future__ import annotations

import hashlib
import uuid
from datetime import datetime
from unittest.mock import MagicMock

import pytest

from app.models.domain import (
    Brand,
    BrandDomains,
    BrandPolicy,
    BrandResend,
    BrandSenders,
    Customer,
    Thread,
    ThreadRfc,
    ThreadStatus,
)
from app.repos.memory_repo import MemoryBrandRepo, MemoryCustomerRepo, MemoryThreadRepo
from tests.conftest import make_trustmatch_brand


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _customer_id(email: str) -> str:
    return hashlib.sha256(email.lower().encode()).hexdigest()


def make_thread_with_customer(
    brand_repo: MemoryBrandRepo,
    customer_repo: MemoryCustomerRepo,
    thread_repo: MemoryThreadRepo,
    status: ThreadStatus = ThreadStatus.awaiting_human,
    subject: str = "Test subject",
    customer_email: str = "customer@example.com",
    root_message_id: str | None = None,
    references: list[str] | None = None,
) -> tuple[Thread, Customer]:
    """Create a thread and matching customer in the repos. Returns (thread, customer)."""
    cid = _customer_id(customer_email)
    now = datetime.utcnow()

    if root_message_id is None:
        root_message_id = f"<root-{uuid.uuid4().hex}@example.com>"

    customer = Customer(
        id=cid,
        brandId="trustmatch",
        email=customer_email,
        name="Test Customer",
        firstSeen=now,
        lastSeen=now,
        threadIds=[],
    )
    customer_repo.upsert("trustmatch", customer)

    thread = Thread(
        id=uuid.uuid4().hex,
        brandId="trustmatch",
        customerId=cid,
        subject=subject,
        status=status,
        rfc=ThreadRfc(
            rootMessageId=root_message_id,
            references=references or [],
        ),
        lastInboundAt=now,
        createdAt=now,
        updatedAt=now,
    )
    thread_repo.create(thread)
    return thread, customer


# ---------------------------------------------------------------------------
# test_reply_sets_correct_threading_headers
# ---------------------------------------------------------------------------

def test_reply_sets_correct_threading_headers(
    client, brand_repo, customer_repo, thread_repo, mock_resend_client
):
    """
    The Resend send() call must include correct In-Reply-To, References,
    and Message-ID headers.
    """
    root_id = f"<root-{uuid.uuid4().hex}@example.com>"
    existing_ref = f"<ref1-{uuid.uuid4().hex}@example.com>"
    thread, _ = make_thread_with_customer(
        brand_repo,
        customer_repo,
        thread_repo,
        root_message_id=root_id,
        references=[existing_ref],
    )

    response = client.post(f"/threads/{thread.id}/reply", json={"body": "Hello there"})
    assert response.status_code == 200

    # Check that Resend was called
    mock_resend_client.send.assert_called_once()
    call_params = mock_resend_client.send.call_args[0][0]

    headers = call_params["headers"]
    assert headers["In-Reply-To"] == root_id
    assert "Message-ID" in headers
    # References should contain the existing ref and root
    assert existing_ref in headers["References"]
    assert root_id in headers["References"]


# ---------------------------------------------------------------------------
# test_reply_subject_unchanged
# ---------------------------------------------------------------------------

def test_reply_subject_unchanged(
    client, brand_repo, customer_repo, thread_repo, mock_resend_client
):
    """Subject in the send call must match thread.subject exactly — no 'Re:' prefix."""
    subject = "My original subject"
    thread, _ = make_thread_with_customer(
        brand_repo, customer_repo, thread_repo, subject=subject
    )

    response = client.post(f"/threads/{thread.id}/reply", json={"body": "Here is my reply."})
    assert response.status_code == 200

    call_params = mock_resend_client.send.call_args[0][0]
    assert call_params["subject"] == subject
    assert not call_params["subject"].startswith("Re:")


# ---------------------------------------------------------------------------
# test_reply_appends_outbound_message
# ---------------------------------------------------------------------------

def test_reply_appends_outbound_message(
    client, brand_repo, customer_repo, thread_repo, mock_resend_client
):
    """Sending a reply must append an outbound message to the thread."""
    thread, _ = make_thread_with_customer(brand_repo, customer_repo, thread_repo)

    response = client.post(f"/threads/{thread.id}/reply", json={"body": "This is a reply."})
    assert response.status_code == 200

    messages = thread_repo.get_messages(thread.id)
    assert len(messages) == 1
    msg = messages[0]
    assert msg.direction == "outbound"
    assert msg.sentVia == "resend"
    assert msg.bodyText == "This is a reply."


# ---------------------------------------------------------------------------
# test_reply_updates_thread_status
# ---------------------------------------------------------------------------

def test_reply_updates_thread_status(
    client, brand_repo, customer_repo, thread_repo, mock_resend_client
):
    """
    A thread in 'awaiting_human' status must transition to 'open' after a reply.
    """
    thread, _ = make_thread_with_customer(
        brand_repo,
        customer_repo,
        thread_repo,
        status=ThreadStatus.awaiting_human,
    )
    assert thread.status == ThreadStatus.awaiting_human

    response = client.post(f"/threads/{thread.id}/reply", json={"body": "Here you go."})
    assert response.status_code == 200

    updated_thread = thread_repo.get(thread.id)
    assert updated_thread.status == ThreadStatus.open


# ---------------------------------------------------------------------------
# test_transactional_uses_noreply_sender
# ---------------------------------------------------------------------------

def test_transactional_uses_noreply_sender(
    client, brand_repo, mock_resend_client
):
    """Transactional send must use brand.senders.noReply as the `from` address."""
    response = client.post(
        "/transactional/send",
        json={
            "brandId": "trustmatch",
            "template": "verification_success",
            "to": "user@example.com",
            "vars": {"name": "Alice", "app_name": "TrustMatch"},
        },
    )
    assert response.status_code == 200

    call_params = mock_resend_client.send.call_args[0][0]
    assert call_params["from"] == "no-reply@hey.trustmatch.io"


# ---------------------------------------------------------------------------
# test_transactional_unknown_brand_returns_404
# ---------------------------------------------------------------------------

def test_transactional_unknown_brand_returns_404(client, mock_resend_client):
    """Transactional send for unknown brand must return 404."""
    response = client.post(
        "/transactional/send",
        json={
            "brandId": "nonexistent-brand",
            "template": "verification_success",
            "to": "user@example.com",
            "vars": {},
        },
    )
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# test_transactional_renders_vars
# ---------------------------------------------------------------------------

def test_transactional_renders_vars(client, brand_repo, mock_resend_client):
    """Template variables must be substituted into the email body."""
    response = client.post(
        "/transactional/send",
        json={
            "brandId": "trustmatch",
            "template": "password_reset",
            "to": "user@example.com",
            "vars": {
                "name": "Bob",
                "app_name": "TrustMatch",
                "reset_link": "https://trustmatch.io/reset/abc123",
                "expiry": "24 hours",
            },
        },
    )
    assert response.status_code == 200

    call_params = mock_resend_client.send.call_args[0][0]
    # Vars should be rendered in the text body
    assert "Bob" in call_params["text"]
    assert "TrustMatch" in call_params["text"]
    assert "https://trustmatch.io/reset/abc123" in call_params["text"]
    assert "24 hours" in call_params["text"]
    # No un-rendered placeholders
    assert "{name}" not in call_params["text"]
    assert "{reset_link}" not in call_params["text"]
