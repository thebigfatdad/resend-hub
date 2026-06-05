"""Pytest fixtures shared across all tests."""
from __future__ import annotations

import json
import os
import uuid
from datetime import datetime
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.deps import (
    get_brand_repo,
    get_customer_repo,
    get_thread_repo,
    get_resend_client,
)
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

# ---------------------------------------------------------------------------
# Webhook secret used across tests
# ---------------------------------------------------------------------------
TEST_WEBHOOK_SECRET = "whsec_dGVzdHNlY3JldGtleWZvcnRlc3Rpbmcx"  # base64 of "testsecretkeyfortesting1"
TRUSTMATCH_SECRET_ENV_VAR = "RESEND_WEBHOOK_SECRET_TRUSTMATCH"


# ---------------------------------------------------------------------------
# Brand fixture
# ---------------------------------------------------------------------------
def make_trustmatch_brand() -> Brand:
    return Brand(
        id="trustmatch",
        name="TrustMatch",
        status="active",
        domains=BrandDomains(
            sendingDomain="trustmatch.io",
            supportSubdomain="hey.trustmatch.io",
        ),
        senders=BrandSenders(
            support="support@hey.trustmatch.io",
            noReply="no-reply@hey.trustmatch.io",
        ),
        resend=BrandResend(
            domainId="placeholder_domain_id",
            webhookSecretRef=TRUSTMATCH_SECRET_ENV_VAR,
        ),
        policy=BrandPolicy(
            autoSendEnabled=False,
            confidenceThreshold=0.75,
            retrievalThreshold=0.70,
            sentimentFloor=-0.3,
            hardEscalateIntents=[
                "billing_dispute",
                "cancellation",
                "refund",
                "privacy_request",
                "legal",
                "complaint",
            ],
        ),
    )


# ---------------------------------------------------------------------------
# Fake ReceivedEmail builder
# ---------------------------------------------------------------------------
def make_fake_received_email(
    email_id: str = "email_abc123",
    from_field: str = "Alice Test <alice@example.com>",
    to: list[str] | None = None,
    subject: str = "Hello TrustMatch",
    text: str = "Hello, I have a question.",
    html: str | None = None,
    message_id: str | None = None,
    in_reply_to: str | None = None,
    references: str | None = None,
):
    if to is None:
        to = ["support@hey.trustmatch.io"]
    if message_id is None:
        message_id = f"<{uuid.uuid4().hex}@example.com>"

    headers: dict[str, str] = {
        "Message-ID": message_id,
    }
    if in_reply_to:
        headers["In-Reply-To"] = in_reply_to
    if references:
        headers["References"] = references

    fake = SimpleNamespace(
        id=email_id,
        from_=from_field,
        to=to,
        subject=subject,
        text=text,
        html=html or f"<p>{text}</p>",
        bcc=None,
        cc=None,
        reply_to=None,
        message_id=message_id,
        headers=headers,
        attachments=[],
        created_at=datetime.utcnow().isoformat(),
    )
    return fake


# ---------------------------------------------------------------------------
# Webhook payload builder
# ---------------------------------------------------------------------------
def make_webhook_payload(
    email_id: str = "email_abc123",
    to: str = "support@hey.trustmatch.io",
) -> bytes:
    payload = {
        "type": "email.received",
        "created_at": datetime.utcnow().isoformat(),
        "data": {
            "email_id": email_id,
            "created_at": datetime.utcnow().isoformat(),
            "from": "alice@example.com",
            "to": [to],
            "bcc": None,
            "cc": None,
            "message_id": f"<{uuid.uuid4().hex}@example.com>",
            "subject": "Hello TrustMatch",
            "attachments": [],
        },
    }
    return json.dumps(payload).encode("utf-8")


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def brand_repo() -> MemoryBrandRepo:
    repo = MemoryBrandRepo([make_trustmatch_brand()])
    return repo


@pytest.fixture
def customer_repo() -> MemoryCustomerRepo:
    return MemoryCustomerRepo()


@pytest.fixture
def thread_repo() -> MemoryThreadRepo:
    return MemoryThreadRepo()


@pytest.fixture
def mock_resend_client(make_received_email=None):
    client = MagicMock()
    fake_email = make_fake_received_email()
    client.get_received.return_value = fake_email
    client.send.return_value = {"id": f"resend_{uuid.uuid4().hex[:8]}"}
    return client


@pytest.fixture
def client(brand_repo, customer_repo, thread_repo, mock_resend_client):
    """TestClient with all repos and resend client overridden to in-memory."""
    app.dependency_overrides[get_brand_repo] = lambda: brand_repo
    app.dependency_overrides[get_customer_repo] = lambda: customer_repo
    app.dependency_overrides[get_thread_repo] = lambda: thread_repo
    app.dependency_overrides[get_resend_client] = lambda: mock_resend_client

    with patch.dict(os.environ, {TRUSTMATCH_SECRET_ENV_VAR: TEST_WEBHOOK_SECRET}):
        with TestClient(app) as tc:
            yield tc

    app.dependency_overrides.clear()
