"""Data access and workflows for Milestone 6: Deliveries, Escalations, Notices, and Replies.

Follows database/schema.sql, docs/DECISIONS.md, and docs/api/ENDPOINT_PROPOSAL.md.
Integrates domain logic from backend.src.domain and backend.src.application.
"""

from __future__ import annotations

import hashlib
import json
import secrets
from datetime import UTC, date, datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.src.domain.reply_assessment import (
    AssessmentAction,
    ReplyReason,
    assess_reply,
)
from vio_backend import audit


def hash_token(token: str) -> bytes:
    return hashlib.sha256(token.encode("utf-8")).digest()


def generate_delivery_token() -> tuple[str, bytes]:
    raw_token = secrets.token_urlsafe(32)
    return raw_token, hash_token(raw_token)


# -----------------------------------------------------------------------------
# 1. CLASS NOTICES & LECTURER REPLIES
# -----------------------------------------------------------------------------

async def create_class_notice(
    session: AsyncSession,
    *,
    course_id: str,
    lecturer_id: str,
    kind: str,
    for_date: date,
    new_start: datetime | None = None,
    note: str | None = None,
) -> str:
    """Inserts a class notice posted by a lecturer."""
    query = """
        INSERT INTO class_notices (course_id, lecturer_id, kind, for_date, new_start, note, posted_at)
        VALUES (:course_id, :lecturer_id, :kind::notice_kind, :for_date, :new_start, :note, now())
        RETURNING id
    """
    res = await session.execute(
        text(query),
        {
            "course_id": course_id,
            "lecturer_id": lecturer_id,
            "kind": kind,
            "for_date": for_date,
            "new_start": new_start,
            "note": note,
        },
    )
    notice_id = res.scalar_one()
    return str(notice_id)


async def save_lecturer_reply(
    session: AsyncSession,
    *,
    finding_id: str,
    lecturer_id: str,
    reason: ReplyReason,
    body: str,
) -> tuple[str, str]:
    """Records a lecturer reply and automatically evaluates assessment actions."""
    # Run the other dev's domain assessment
    assessment = assess_reply(reason=reason, explanation=body)

    query = """
        INSERT INTO lecturer_replies (finding_id, lecturer_id, reason, body, created_at)
        VALUES (:finding_id, :lecturer_id, :reason::reply_reason, :body, now())
        RETURNING id
    """
    res = await session.execute(
        text(query),
        {
            "finding_id": finding_id,
            "lecturer_id": lecturer_id,
            "reason": reason.value,
            "body": body,
        },
    )
    reply_id = str(res.scalar_one())

    # Log to decision_log
    await audit.record_decision(
        session,
        finding_id=finding_id,
        stage="reply",
        actor="lecturer_reply_service",
        decision=f"reply_received_{reason.value}",
        details={
            "reply_id": reply_id,
            "reason": reason.value,
            "assessment_action": assessment.action.value,
        },
    )

    # If disputed, automatically register an appeal
    if assessment.action == AssessmentAction.REFER_TO_APPEALS:
        await file_appeal(
            session,
            finding_id=finding_id,
            appellant="lecturer",
            appellant_id=lecturer_id,
            body=f"Lecturer disputed finding: {body}",
        )

    return reply_id, assessment.action.value


# -----------------------------------------------------------------------------
# 2. DELIVERIES & AUTHORITY ROUTING
# -----------------------------------------------------------------------------
