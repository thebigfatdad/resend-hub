"""Firestore repository implementations."""
from __future__ import annotations

import copy
from datetime import datetime
from typing import Any

from google.cloud import firestore

from app.models.domain import Brand, BrandDomains, BrandSenders, BrandResend, BrandPolicy
from app.models.domain import Customer, Thread, ThreadRfc, ThreadStatus, Message
from app.models.domain import MessageAttachment, MessageHeaders, MessageAI


def _brand_from_doc(doc_id: str, data: dict) -> Brand:
    return Brand(
        id=doc_id,
        name=data["name"],
        status=data.get("status", "active"),
        domains=BrandDomains(**data["domains"]),
        senders=BrandSenders(**data["senders"]),
        resend=BrandResend(**data["resend"]),
        voiceProfileId=data.get("voiceProfileId"),
        policy=BrandPolicy(**data.get("policy", {})),
        createdAt=data.get("createdAt", datetime.utcnow()),
        updatedAt=data.get("updatedAt", datetime.utcnow()),
    )


def _thread_from_doc(doc_id: str, data: dict) -> Thread:
    rfc_data = data.get("rfc", {})
    return Thread(
        id=doc_id,
        brandId=data["brandId"],
        customerId=data["customerId"],
        subject=data["subject"],
        status=ThreadStatus(data.get("status", "open")),
        assignee=data.get("assignee"),
        snoozeUntil=data.get("snoozeUntil"),
        rfc=ThreadRfc(
            rootMessageId=rfc_data.get("rootMessageId", ""),
            references=rfc_data.get("references", []),
        ),
        intent=data.get("intent"),
        sentiment=data.get("sentiment"),
        lastInboundAt=data.get("lastInboundAt"),
        lastOutboundAt=data.get("lastOutboundAt"),
        createdAt=data.get("createdAt", datetime.utcnow()),
        updatedAt=data.get("updatedAt", datetime.utcnow()),
    )


def _message_from_doc(doc_id: str, data: dict) -> Message:
    headers_data = data.get("headers", {})
    ai_data = data.get("ai", {})
    return Message.model_validate({
        "id": doc_id,
        "threadId": data.get("threadId", ""),
        "direction": data["direction"],
        "from": data["from"],
        "to": data.get("to", []),
        "subject": data.get("subject", ""),
        "bodyText": data.get("bodyText"),
        "bodyHtml": data.get("bodyHtml"),
        "attachments": [MessageAttachment(**a) for a in data.get("attachments", [])],
        "headers": MessageHeaders(
            messageId=headers_data.get("messageId", ""),
            inReplyTo=headers_data.get("inReplyTo"),
            references=headers_data.get("references", []),
        ),
        "ai": MessageAI(**ai_data) if ai_data else MessageAI(),
        "sentVia": data.get("sentVia"),
        "resendId": data.get("resendId"),
        "createdAt": data.get("createdAt", datetime.utcnow()),
    })


class FirestoreBrandRepo:
    def __init__(self, client: firestore.Client) -> None:
        self._db = client

    def get(self, brand_id: str) -> Brand | None:
        doc = self._db.collection("brands").document(brand_id).get()
        if not doc.exists:
            return None
        return _brand_from_doc(doc.id, doc.to_dict())

    def get_by_support_email(self, email: str) -> Brand | None:
        docs = (
            self._db.collection("brands")
            .where("senders.support", "==", email)
            .limit(1)
            .stream()
        )
        for doc in docs:
            return _brand_from_doc(doc.id, doc.to_dict())
        return None

    def list(self) -> list[Brand]:
        return [_brand_from_doc(d.id, d.to_dict()) for d in self._db.collection("brands").stream()]


class FirestoreCustomerRepo:
    def __init__(self, client: firestore.Client) -> None:
        self._db = client

    def get(self, brand_id: str, customer_id: str) -> Customer | None:
        doc = (
            self._db.collection("brands")
            .document(brand_id)
            .collection("customers")
            .document(customer_id)
            .get()
        )
        if not doc.exists:
            return None
        data = doc.to_dict()
        return Customer(
            id=doc.id,
            brandId=brand_id,
            email=data["email"],
            name=data.get("name"),
            firstSeen=data.get("firstSeen", datetime.utcnow()),
            lastSeen=data.get("lastSeen", datetime.utcnow()),
            threadIds=data.get("threadIds", []),
            meta=data.get("meta", {}),
        )

    def upsert(self, brand_id: str, customer: Customer) -> None:
        ref = (
            self._db.collection("brands")
            .document(brand_id)
            .collection("customers")
            .document(customer.id)
        )
        ref.set(
            {
                "email": customer.email,
                "name": customer.name,
                "firstSeen": customer.firstSeen,
                "lastSeen": customer.lastSeen,
                "threadIds": customer.threadIds,
                "meta": customer.meta,
            },
            merge=True,
        )


class FirestoreThreadRepo:
    def __init__(self, client: firestore.Client) -> None:
        self._db = client

    def get(self, thread_id: str) -> Thread | None:
        doc = self._db.collection("threads").document(thread_id).get()
        if not doc.exists:
            return None
        return _thread_from_doc(doc.id, doc.to_dict())

    def create(self, thread: Thread) -> None:
        data = {
            "brandId": thread.brandId,
            "customerId": thread.customerId,
            "subject": thread.subject,
            "status": thread.status.value,
            "assignee": thread.assignee,
            "snoozeUntil": thread.snoozeUntil,
            "rfc": {
                "rootMessageId": thread.rfc.rootMessageId,
                "references": thread.rfc.references,
            },
            "intent": thread.intent,
            "sentiment": thread.sentiment,
            "lastInboundAt": thread.lastInboundAt,
            "lastOutboundAt": thread.lastOutboundAt,
            "createdAt": thread.createdAt,
            "updatedAt": thread.updatedAt,
        }
        self._db.collection("threads").document(thread.id).set(data)

    def update(self, thread_id: str, patch: dict) -> None:
        self._db.collection("threads").document(thread_id).update(patch)

    def list(
        self,
        brand_id: str | None = None,
        status: str | None = None,
        q: str | None = None,
        assignee: str | None = None,
    ) -> list[Thread]:
        query = self._db.collection("threads")
        if brand_id is not None:
            query = query.where("brandId", "==", brand_id)
        if status is not None:
            query = query.where("status", "==", status)
        if assignee is not None:
            query = query.where("assignee", "==", assignee)
        results = [_thread_from_doc(d.id, d.to_dict()) for d in query.stream()]
        if q is not None:
            q_lower = q.lower()
            results = [t for t in results if q_lower in t.subject.lower()]
        results.sort(key=lambda t: t.updatedAt, reverse=True)
        return results

    def find_by_rfc(self, message_id: str) -> Thread | None:
        # Check rootMessageId
        docs = (
            self._db.collection("threads")
            .where("rfc.rootMessageId", "==", message_id)
            .limit(1)
            .stream()
        )
        for doc in docs:
            return _thread_from_doc(doc.id, doc.to_dict())
        # Check references array
        docs = (
            self._db.collection("threads")
            .where("rfc.references", "array_contains", message_id)
            .limit(1)
            .stream()
        )
        for doc in docs:
            return _thread_from_doc(doc.id, doc.to_dict())
        return None

    def find_by_subject_customer(
        self, brand_id: str, subject: str, customer_id: str
    ) -> Thread | None:
        docs = (
            self._db.collection("threads")
            .where("brandId", "==", brand_id)
            .where("customerId", "==", customer_id)
            .where("subject", "==", subject)
            .stream()
        )
        for doc in docs:
            t = _thread_from_doc(doc.id, doc.to_dict())
            if t.status != ThreadStatus.closed:
                return t
        return None

    def add_message(self, thread_id: str, message: Message) -> str:
        data = {
            "threadId": message.threadId,
            "direction": message.direction,
            "from": message.from_,
            "to": message.to,
            "subject": message.subject,
            "bodyText": message.bodyText,
            "bodyHtml": message.bodyHtml,
            "attachments": [a.model_dump() for a in message.attachments],
            "headers": {
                "messageId": message.headers.messageId,
                "inReplyTo": message.headers.inReplyTo,
                "references": message.headers.references,
            },
            "ai": message.ai.model_dump(),
            "sentVia": message.sentVia,
            "resendId": message.resendId,
            "createdAt": message.createdAt,
        }
        self._db.collection("threads").document(thread_id).collection("messages").document(
            message.id
        ).set(data)
        return message.id

    def get_messages(self, thread_id: str) -> list[Message]:
        docs = (
            self._db.collection("threads")
            .document(thread_id)
            .collection("messages")
            .order_by("createdAt")
            .stream()
        )
        return [_message_from_doc(d.id, d.to_dict()) for d in docs]
