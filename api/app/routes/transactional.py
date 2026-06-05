"""Transactional email send route."""
from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.deps import BrandRepoDep, ResendClientDep
from app.services.outbound import send_transactional

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/transactional", tags=["transactional"])


class TransactionalSendRequest(BaseModel):
    brandId: str
    template: str
    to: str
    vars: dict[str, Any] = {}


@router.post("/send")
async def transactional_send(
    req: TransactionalSendRequest,
    brand_repo: BrandRepoDep,
    resend_client: ResendClientDep,
) -> dict:
    """
    Send a transactional email (from no-reply sender) using a named template.
    """
    try:
        result = send_transactional(
            brand_id=req.brandId,
            template=req.template,
            to=req.to,
            vars=req.vars,
            brand_repo=brand_repo,
            resend_client=resend_client,
        )
    except ValueError as exc:
        msg = str(exc)
        if "not found" in msg.lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=msg,
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=msg,
        )
    except KeyError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )

    logger.info(
        "Transactional email sent",
        extra={
            "brand_id": req.brandId,
            "template": req.template,
            "to": req.to,
            "resend_id": result.get("id"),
        },
    )

    return result
