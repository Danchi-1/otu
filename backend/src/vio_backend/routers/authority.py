"""Authority router for delivery access, acknowledgement, responses, and escalation (M6).

Follows docs/api/ENDPOINT_PROPOSAL.md and database/schema.sql.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from vio_backend import delivery_store
from vio_backend.database import session_dependency
from vio_backend.errors import ApiError

router = APIRouter(prefix="/api/v1/authority", tags=["authority"])


class RedeemTokenRequest(BaseModel):
    token: str = Field(min_length=16, max_length=128)


class AuthorityResponseRequest(BaseModel):
    outcome: str = Field(description="action_taken, explanation_accepted, disputed, no_action")
    body: str = Field(min_length=1, max_length=4000)


class AuthorityAppealRequest(BaseModel):
    body: str = Field(min_length=1, max_length=2000)


@router.post("/access")
async def redeem_access_token(
    body: RedeemTokenRequest,
    session: AsyncSession = Depends(session_dependency),
) -> dict:
    """Redeems a secure, one-time delivery link token."""
    delivery_data = await delivery_store.redeem_delivery_token(session, body.token)
    if delivery_data is None:
        raise ApiError(404, "not_found", "The access link is invalid, expired, or already used.")
    await session.commit()

    return {
        "data": {
            "delivery_id": str(delivery_data["delivery_id"]),
            "finding_id": str(delivery_data["finding_id"]),
            "authority_role": delivery_data["authority_role"],
            "authority_name": delivery_data["authority_name"],
            "step_order": delivery_data["step_order"],
            "status": delivery_data["status"],
            "due_at": delivery_data["due_at"].isoformat() if delivery_data["due_at"] else None,
            "incident": {
                "course_code": delivery_data["course_code"],
                "course_title": delivery_data["course_title"],
                "department": delivery_data["department_name"],
                "category": delivery_data["category"],
                "incident_date": delivery_data["incident_date"].isoformat() if delivery_data["incident_date"] else None,
                "public_summary": delivery_data["public_summary"],
                "clearance_tier": delivery_data["clearance_tier"],
            },
        }
    }


@router.post("/deliveries/{delivery_id}/acknowledgement")
async def acknowledge_delivery(
    delivery_id: UUID,
    session: AsyncSession = Depends(session_dependency),
) -> dict:
    """Marks a delivery as officially acknowledged by the authority."""
    success = await delivery_store.acknowledge_delivery(session, str(delivery_id))
    if not success:
        raise ApiError(404, "not_found", "Delivery not found or cannot be acknowledged.")
    await session.commit()

    return {
        "data": {
            "delivery_id": str(delivery_id),
            "status": "acknowledged",
            "message": "Delivery receipt acknowledged.",
        }
    }


@router.post("/deliveries/{delivery_id}/responses")
async def submit_response(
    delivery_id: UUID,
    body: AuthorityResponseRequest,
    session: AsyncSession = Depends(session_dependency),
) -> dict:
    """Records an official outcome and explanation from the authority."""
    if body.outcome not in ("action_taken", "explanation_accepted", "disputed", "no_action"):
        raise ApiError(400, "invalid_request", "Invalid response outcome.")

    resp_id = await delivery_store.record_authority_response(
        session,
        delivery_id=str(delivery_id),
        outcome=body.outcome,
        body=body.body,
    )
    if resp_id is None:
        raise ApiError(404, "not_found", "Delivery not found.")
    await session.commit()

    return {
        "data": {
            "response_id": resp_id,
            "delivery_id": str(delivery_id),
            "outcome": body.outcome,
            "status": "responded",
            "message": "Authority response recorded.",
        }
    }


@router.post("/deliveries/{delivery_id}/appeals")
async def submit_appeal(
    delivery_id: UUID,
    body: AuthorityAppealRequest,
    session: AsyncSession = Depends(session_dependency),
) -> dict:
    """Files an official authority appeal on a delivery finding."""
    # Find authority and finding for this delivery
    res = await delivery_store.redeem_delivery_token(session, "")  # fallback or fetch
    query = "SELECT finding_id, authority_id FROM deliveries WHERE id = :id"
    d_res = await session.execute(
        delivery_store.text(query), {"id": str(delivery_id)}
    )
    row = d_res.first()
    if row is None:
        raise ApiError(404, "not_found", "Delivery not found.")

    finding_id, auth_id = str(row[0]), str(row[1])
    appeal_id = await delivery_store.file_appeal(
        session,
        finding_id=finding_id,
        appellant="authority",
        appellant_id=auth_id,
        body=body.body,
    )
    await session.commit()

    return {
        "data": {
            "appeal_id": appeal_id,
            "finding_id": finding_id,
            "status": "open",
            "message": "Appeal filed successfully.",
        }
    }


@router.post("/escalations/process")
async def trigger_escalation_process(
    session: AsyncSession = Depends(session_dependency),
) -> dict:
    """Worker endpoint to process unacknowledged overdue deliveries."""
    escalated = await delivery_store.process_overdue_escalations(session)
    await session.commit()
    return {
        "data": {
            "processed_count": len(escalated),
            "escalated_deliveries": escalated,
        }
    }
