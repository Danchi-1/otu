from datetime import date, datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.src.domain.reply_assessment import AssessmentAction, ReplyReason, assess_reply
from vio_backend.delivery_store import (
    generate_delivery_token,
    hash_token,
    process_overdue_escalations,
    save_lecturer_reply,
)


def test_token_generation_and_hashing():
    raw, hashed = generate_delivery_token()
    assert len(raw) >= 32
    assert len(hashed) == 32
    assert hash_token(raw) == hashed


def test_assess_reply_dispute_refers_to_appeals():
    assessment = assess_reply(ReplyReason.DISPUTED, "I held this class in the physics lab.")
    assert assessment.action == AssessmentAction.REFER_TO_APPEALS
    assert assessment.reason == ReplyReason.DISPUTED


def test_assess_reply_illness_records_explanation():
    assessment = assess_reply(ReplyReason.ILLNESS, "I was hospitalized on that day.")
    assert assessment.action == AssessmentAction.RECORD_EXPLANATION


def test_assess_reply_rescheduled_verifies_evidence():
    assessment = assess_reply(ReplyReason.RESCHEDULED, "The class was moved to Wednesday 2pm.")
    assert assessment.action == AssessmentAction.VERIFY_EVIDENCE


@pytest.mark.asyncio
async def test_save_lecturer_reply_records_and_appeals_if_disputed():
    session = AsyncMock()

    # Mock insert lecturer_replies
    mock_reply_ins = MagicMock()
    mock_reply_ins.scalar_one.return_value = "00000000-0000-0000-0000-000000000001"

    # Mock decision log & appeal insert
    mock_hash = MagicMock()
    mock_hash.first.return_value = None
    mock_hash.scalar_one.return_value = 1

    session.execute.side_effect = [
        mock_reply_ins,  # INSERT INTO lecturer_replies
        mock_hash,       # SELECT entry_hash from decision_log
        mock_hash,       # INSERT INTO decision_log RETURNING id
        mock_reply_ins,  # INSERT INTO appeals (since DISPUTED)
        MagicMock(),     # UPDATE findings SET status = 'disputed'
        mock_hash,       # SELECT entry_hash from decision_log
        mock_hash,       # INSERT INTO decision_log RETURNING id
    ]

    reply_id, action = await save_lecturer_reply(
        session,
        finding_id="f1",
        lecturer_id="l1",
        reason=ReplyReason.DISPUTED,
        body="This lecture held at the scheduled venue.",
    )

    assert reply_id == "00000000-0000-0000-0000-000000000001"
    assert action == "refer_to_appeals"


@pytest.mark.asyncio
