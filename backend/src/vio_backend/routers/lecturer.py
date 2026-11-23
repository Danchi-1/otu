"""Lecturer router for class notices, reply submissions, and case tracking (M6).

Integrates the domain and service layers implemented by the backend team:
- backend.src.domain.reply_assessment
- backend.src.domain.lecturer_reply
- backend.src.application.lecturer_reply_service
- backend.src.api.lecturer_reply_api
"""

from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from backend.src.domain.reply_assessment import ReplyReason
from vio_backend import delivery_store
from vio_backend.database import session_dependency
from vio_backend.errors import ApiError

router = APIRouter(prefix="/api/v1/lecturer", tags=["lecturer"])


class PostClassNoticeRequest(BaseModel):
    course_id: UUID
    lecturer_id: UUID
    kind: str = Field(description="cancelled, rescheduled, extra_class")
    for_date: date
    new_start: datetime | None = None
    note: str | None = Field(default=None, max_length=1000)


class SubmitLecturerReplyRequest(BaseModel):
    finding_id: UUID
    lecturer_id: UUID
    reason: ReplyReason
    body: str = Field(min_length=1, max_length=2000)


@router.post("/class-notices")
async def post_class_notice(
    body: PostClassNoticeRequest,
    session: AsyncSession = Depends(session_dependency),
) -> dict:
    if body.kind not in ("cancelled", "rescheduled", "extra_class"):
        raise ApiError(400, "invalid_request", "Invalid notice kind.")

    notice_id = await delivery_store.create_class_notice(
        session,
        course_id=str(body.course_id),
        lecturer_id=str(body.lecturer_id),
        kind=body.kind,
        for_date=body.for_date,
        new_start=body.new_start,
        note=body.note,
    )
    await session.commit()

    return {
        "data": {
            "notice_id": notice_id,
            "course_id": str(body.course_id),
            "kind": body.kind,
            "for_date": body.for_date.isoformat(),
            "status": "posted",
            "message": "Class notice posted successfully.",
        }
    }


@router.post("/replies")
async def submit_reply(
    body: SubmitLecturerReplyRequest,
    session: AsyncSession = Depends(session_dependency),
) -> dict:
    try:
        reply_id, assessment_action = await delivery_store.save_lecturer_reply(
            session,
            finding_id=str(body.finding_id),
            lecturer_id=str(body.lecturer_id),
            reason=body.reason,
            body=body.body,
        )
        await session.commit()
    except ValueError as exc:
        raise ApiError(400, "invalid_request", str(exc)) from exc

    return {
        "data": {
            "reply_id": reply_id,
            "finding_id": str(body.finding_id),
            "reason": body.reason.value,
            "assessment_action": assessment_action,
            "message": "Reply recorded and assessed.",
        }
    }
