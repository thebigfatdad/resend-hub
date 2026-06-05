"""In-memory repository implementations for testing."""
from __future__ import annotations

import copy
from datetime import datetime
from typing import Any

from app.models.domain import Brand, Customer, Message, Thread, ThreadStatus


class MemoryBrandRepo:
    def __init__(self, brands: list[Brand] | None = None) -> None:
        self._brands: dict[str, Brand] = {}
        for brand in brands or []:
            self._brands[brand.id] = brand

    def get(self, brand_id: str) -> Brand | None:
        return self._brands.get(brand_id)

    def get_by_support_email(self, email: str) -> Brand | None:
        for brand in self._brands.values():
            if brand.senders.support == email:
                return brand
        return None

    def list(self) -> list[Brand]:
        return list(self._brands.values())

    def upsert(self, brand: Brand) -> None:
        self._brands[brand.id] = brand


class MemoryCustomerRepo:
    def __init__(self) -> None:
        # key: (brand_id, customer_id)
        self._customers: dict[tuple[str, str], Customer] = {}

    def get(self, brand_id: str, customer_id: str) -> Customer | None:
        return self._customers.get((brand_id, customer_id))

    def upsert(self, brand_id: str, customer: Customer) -> None:
        self._customers[(brand_id, customer.id)] = copy.deepcopy(customer)


class MemoryThreadRepo:
    def __init__(self) -> None:
        self._threads: dict[str, Thread] = {}
        self._messages: dict[str, dict[str, Message]] = {}  # thread_id -> {msg_id -> Message}
        self._msg_counter: int = 0

    def get(self, thread_id: str) -> Thread | None:
        return self._threads.get(thread_id)

    def create(self, thread: Thread) -> None:
        self._threads[thread.id] = copy.deepcopy(thread)
        self._messages.setdefault(thread.id, {})

    def update(self, thread_id: str, patch: dict) -> None:
        thread = self._threads.get(thread_id)
        if thread is None:
            raise KeyError(f"Thread {thread_id} not found")
        data = thread.model_dump(by_alias=True)
        # Handle nested rfc updates
        for key, value in patch.items():
            if key == "status" and isinstance(value, str):
                data[key] = ThreadStatus(value)
            else:
                data[key] = value
        self._threads[thread_id] = Thread.model_validate(data)

    def list(
        self,
        brand_id: str | None = None,
        status: str | None = None,
        q: str | None = None,
        assignee: str | None = None,
    ) -> list[Thread]:
        results = list(self._threads.values())
        if brand_id is not None:
            results = [t for t in results if t.brandId == brand_id]
        if status is not None:
            results = [t for t in results if t.status.value == status]
        if q is not None:
            q_lower = q.lower()
            results = [t for t in results if q_lower in t.subject.lower()]
        if assignee is not None:
            results = [t for t in results if t.assignee == assignee]
        results.sort(key=lambda t: t.updatedAt, reverse=True)
        return results

    def find_by_rfc(self, message_id: str) -> Thread | None:
        """Find a thread whose rootMessageId or references contain the given message_id."""
        for thread in self._threads.values():
            if thread.rfc.rootMessageId == message_id:
                return thread
            if message_id in thread.rfc.references:
                return thread
        return None

    def find_by_subject_customer(
        self, brand_id: str, subject: str, customer_id: str
    ) -> Thread | None:
        for thread in self._threads.values():
            if (
                thread.brandId == brand_id
                and thread.customerId == customer_id
                and thread.subject == subject
                and thread.status != ThreadStatus.closed
            ):
                return thread
        return None

    def add_message(self, thread_id: str, message: Message) -> str:
        if thread_id not in self._messages:
            self._messages[thread_id] = {}
        self._messages[thread_id][message.id] = copy.deepcopy(message)
        return message.id

    def get_messages(self, thread_id: str) -> list[Message]:
        msgs = self._messages.get(thread_id, {})
        return sorted(msgs.values(), key=lambda m: m.createdAt)
