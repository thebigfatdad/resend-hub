"""Domain models for bfd-support-hub."""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Brand
# ---------------------------------------------------------------------------

class BrandDomains(BaseModel):
    sendingDomain: str
    supportSubdomain: str


class BrandSenders(BaseModel):
    support: str
    noReply: str


class BrandResend(BaseModel):
    domainId: str
    webhookSecretRef: str  # name of the env var holding the secret


class BrandPolicy(BaseModel):
    autoSendEnabled: bool = False
    confidenceThreshold: float = 0.75
    retrievalThreshold: float = 0.70
    sentimentFloor: float = -0.3
    hardEscalateIntents: list[str] = Field(default_factory=lambda: [
        "billing_dispute", "cancellation", "refund",
        "privacy_request", "legal", "complaint",
    ])


class Brand(BaseModel):
    id: str
    name: str
    status: str = "active"  # "active" | "paused"
    domains: BrandDomains
    senders: BrandSenders
    resend: BrandResend
    voiceProfileId: str | None = None
    policy: BrandPolicy = Field(default_factory=BrandPolicy)
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)


# ---------------------------------------------------------------------------
# Customer
# ---------------------------------------------------------------------------

class Customer(BaseModel):
    id: str  # sha256(lower(email))
    brandId: str
    email: str
    name: str | None = None
    firstSeen: datetime = Field(default_factory=datetime.utcnow)
    lastSeen: datetime = Field(default_factory=datetime.utcnow)
    threadIds: list[str] = Field(default_factory=list)
    meta: dict[str, Any] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Thread
# ---------------------------------------------------------------------------

class ThreadStatus(str, Enum):
    open = "open"
    auto_replied = "auto_replied"
    awaiting_human = "awaiting_human"
    snoozed = "snoozed"
    closed = "closed"


class ThreadRfc(BaseModel):
    rootMessageId: str
    references: list[str] = Field(default_factory=list)


class Thread(BaseModel):
    id: str
    brandId: str
    customerId: str
    subject: str
    status: ThreadStatus = ThreadStatus.awaiting_human
    assignee: str | None = None
    snoozeUntil: datetime | None = None
    rfc: ThreadRfc
    intent: str | None = None
    sentiment: float | None = None
    lastInboundAt: datetime | None = None
    lastOutboundAt: datetime | None = None
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)


# ---------------------------------------------------------------------------
# Message
# ---------------------------------------------------------------------------

class MessageAttachment(BaseModel):
    id: str
    filename: str
    contentType: str
    size: int
    storagePath: str


class MessageHeaders(BaseModel):
    messageId: str
    inReplyTo: str | None = None
    references: list[str] = Field(default_factory=list)


class MessageAI(BaseModel):
    intent: str | None = None
    confidence: float | None = None
    sentiment: float | None = None
    grounded: bool | None = None
    retrievalHits: list[Any] = Field(default_factory=list)
    draft: str | None = None


class Message(BaseModel):
    id: str
    threadId: str
    direction: str  # "inbound" | "outbound"
    from_: str = Field(alias="from")
    to: list[str]
    subject: str
    bodyText: str | None = None
    bodyHtml: str | None = None
    attachments: list[MessageAttachment] = Field(default_factory=list)
    headers: MessageHeaders
    ai: MessageAI = Field(default_factory=MessageAI)
    sentVia: str | None = None  # "resend" | None
    resendId: str | None = None
    createdAt: datetime = Field(default_factory=datetime.utcnow)

    model_config = {"populate_by_name": True}
