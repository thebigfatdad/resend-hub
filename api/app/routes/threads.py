"""Thread management routes."""
from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.deps import (
    BrandRepoDep,
    CustomerRepoDep,
    ResendClientDep,
    ThreadRepoDep,
)
from app.models.domain import Thread
from app.services.outbound import send_thread_reply

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/threads", tags=["threads"])


class ReplyRequest(BaseModel):
    body: str


@router.get("", response_model=list[Thread])
async def list_threads(
    thread_repo: ThreadRepoDep,
    brandId: Annotated[str | None, Query()] = None,
    status: Annotated[str | None, Query()] = None,
    q: Annotated[str | None, Query()] = None,
    assignee: Annotated[str | None, Query()] = None,
) -> list[Thread]:
    """
    List threads with optional filters.
    Returns threads without messages, sorted by updatedAt desc.
    """
    return thread_repo.list(brand_id=brandId, status=status, q=q, assignee=assignee)


@router.get("/{thread_id}")
async def get_thread(
    thread_id: str,
    thread_repo: ThreadRepoDep,
) -> dict:
    """Return a thread with its messages subcollection."""
    thread = thread_repo.get(thread_id)
    if thread is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Thread {thread_id} not found",
        )
    messages = thread_repo.get_messages(thread_id)
    return {
        **thread.model_dump(),
        "messages": [m.model_dump(by_alias=True) for m in messages],
    }


@router.post("/{thread_id}/reply")
async def reply_to_thread(
    thread_id: str,
    req: ReplyRequest,
    thread_repo: ThreadRepoDep,
    brand_repo: BrandRepoDep,
    customer_repo: CustomerRepoDep,
    resend_client: ResendClientDep,
) -> dict:
    """
    Send a reply to a thread via Resend with correct RFC threading headers.
    Updates thread status to 'open' if it was 'awaiting_human'.
    """
    thread = thread_repo.get(thread_id)
    if thread is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Thread {thread_id} not found",
        )

    try:
        result = send_thread_reply(
            thread=thread,
            body=req.body,
            brand_repo=brand_repo,
            customer_repo=customer_repo,
            thread_repo=thread_repo,
            resend_client=resend_client,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )

    logger.info(
        "Thread reply sent",
        extra={
            "thread_id": thread_id,
            "message_id": result["messageId"],
            "resend_id": result["resendId"],
        },
    )

    return result
