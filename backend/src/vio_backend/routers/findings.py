"""Student findings and confirmation endpoints (M4).

Implements:
- GET /api/v1/student/findings/confirmable
- GET /api/v1/student/findings/{finding_id}
- POST /api/v1/student/findings/{finding_id}/confirmations

Enforces:
- Registered course requirement.
- Reporter/confirmer independence (a student cannot both report and confirm).
- Single confirmation per student.
- Score recomputation on confirmation.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from vio_backend import finding_store, student_auth
from vio_backend.database import session_dependency
from vio_backend.errors import ApiError
from vio_backend.routers.auth import get_current_student
from vio_backend.routers.reports import _CATEGORY_LABELS, _require_confirmed_session, _require_ready

router = APIRouter(prefix="/api/v1/student/findings", tags=["findings"])


class ConfirmationRequest(BaseModel):
    comment: str | None = Field(default=None, max_length=500)


def _format_finding_summary(row: dict) -> dict:
    cat = row["category"]
    return {
        "finding_id": str(row["id"]),
        "course_code": row["course_code"],
        "course_title": row["course_title"],
        "course_level": row["course_level"],
        "department": row["department_name"],
        "category": cat,
        "category_label": _CATEGORY_LABELS.get(cat, cat),
        "incident_date": row["incident_date"].isoformat() if row["incident_date"] else None,
        "status": row["status"],
        "public_summary": row.get("public_summary"),
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
    }


@router.get("/confirmable")
async def list_confirmable_findings(
    cursor: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=50),
    record: student_auth.StudentSession = Depends(get_current_student),
    session: AsyncSession = Depends(session_dependency),
) -> dict:
    _require_ready(record)
    window, academic_session = await _require_confirmed_session(session, record)

    rows, next_cursor = await finding_store.list_confirmable_findings(
        session,
        student_id=record.student_id,
        academic_session=academic_session,
        cursor=cursor,
        limit=limit,
    )
    return {
        "data": [_format_finding_summary(r) for r in rows],
        "meta": {"next_cursor": next_cursor},
    }
