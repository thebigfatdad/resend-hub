"""Cloud Tasks integration — stubbed for Phase 0/1."""
from __future__ import annotations

import logging
import uuid

logger = logging.getLogger(__name__)


def enqueue_ai_task(thread_id: str, message_id: str) -> str:
    """
    Enqueue a Cloud Tasks task for AI processing.

    Phase 0/1 stub: logs the request and returns a synthetic task ID.
    Real Cloud Tasks integration is Phase 2.
    """
    task_id = f"stub-task-{uuid.uuid4().hex[:12]}"
    logger.info(
        "AI task enqueued (stub)",
        extra={
            "task_id": task_id,
            "thread_id": thread_id,
            "message_id": message_id,
        },
    )
    return task_id
