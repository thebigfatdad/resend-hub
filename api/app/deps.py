"""FastAPI dependency injection."""
from __future__ import annotations

from functools import lru_cache
from typing import Annotated

import resend
from fastapi import Depends

from app.config import get_settings
from app.repos.base import BrandRepo, CustomerRepo, ThreadRepo
from app.repos.firestore_repo import (
    FirestoreBrandRepo,
    FirestoreCustomerRepo,
    FirestoreThreadRepo,
)


@lru_cache(maxsize=1)
def get_firestore_client():
    """Return a cached Firestore client."""
    from google.cloud import firestore as _firestore

    settings = get_settings()
    return _firestore.Client(project=settings.google_cloud_project)


def get_brand_repo() -> BrandRepo:
    return FirestoreBrandRepo(get_firestore_client())


def get_customer_repo() -> CustomerRepo:
    return FirestoreCustomerRepo(get_firestore_client())


def get_thread_repo() -> ThreadRepo:
    return FirestoreThreadRepo(get_firestore_client())


class ResendClient:
    """Thin wrapper around the resend SDK."""

    def __init__(self, api_key: str) -> None:
        resend.api_key = api_key

    def send(self, params: dict) -> resend.Email:
        return resend.Emails.send(params)

    def get_received(self, email_id: str):
        return resend.Emails.Receiving.get(email_id)


def get_resend_client() -> ResendClient:
    settings = get_settings()
    return ResendClient(api_key=settings.resend_api_key)


# Type aliases for use in route handlers
BrandRepoDep = Annotated[BrandRepo, Depends(get_brand_repo)]
CustomerRepoDep = Annotated[CustomerRepo, Depends(get_customer_repo)]
ThreadRepoDep = Annotated[ThreadRepo, Depends(get_thread_repo)]
ResendClientDep = Annotated[ResendClient, Depends(get_resend_client)]
