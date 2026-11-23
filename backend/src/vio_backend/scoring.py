"""Deterministic scoring engine for findings and confirmations (M4).

Follows docs/DECISIONS.md (2026-11-07, 2026-11-09):
- Trust is base 0.10 + verified school email 0.55 (= 0.65 for email-verified students).
  Timetable provides 0.00 personal trust and is used for eligibility only.
- Supporter contribution:
    contribution_i = min(0.20, trust_i * 0.25 * anomaly_multiplier_i * false_reliability_i)
- False reliability:
    max(0.50, 0.90 ** finalized_false_finding_count)
- Anomaly multiplier:
    1.0 - max(severity), floored at 0.25
- Finding modifiers:
    Recency pursuit multiplier:
      0-21 days: 1.00
      22-60 days: 0.75
      61-180 days: 0.50
      181-365 days: 0.25
      >365 days: 0.10
    Advance notice multiplier:
      0.50 if announced in advance, else 1.00
- Tier thresholds:
    Tier 1: distinct_reports >= 5 AND score >= 0.80
    Tier 2: total_supporters >= 8 AND score >= 1.30
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Any

FORMULA_VERSION = "v1-balanced"

BASE_TRUST = 0.10
SCHOOL_EMAIL_TRUST = 0.55
CONTRIBUTION_NORMALIZATION = 0.25
PER_SUPPORTER_CAP = 0.20
ANOMALY_MULTIPLIER_FLOOR = 0.25
ADVANCE_NOTICE_MULTIPLIER = 0.50

TIER_1_MIN_REPORTS = 5
TIER_1_MIN_SCORE = 0.80
TIER_2_MIN_SUPPORTERS = 8
TIER_2_MIN_SCORE = 1.30


def compute_recency_multiplier(incident_date: date, as_of: date) -> float:
    days = (as_of - incident_date).days
    if days < 0:
        # Incident claimed today or edge case in same day
        return 1.00
    if days <= 21:
        return 1.00
    if days <= 60:
        return 0.75
    if days <= 180:
        return 0.50
    if days <= 365:
        return 0.25
    return 0.10


def compute_false_reliability(false_finding_count: int) -> float:
    if false_finding_count <= 0:
        return 1.00
    factor = 0.90 ** false_finding_count
    return max(0.50, factor)


def compute_anomaly_multiplier(severities: list[float]) -> float:
    if not severities:
        return 1.00
    max_severity = max(severities)
    multiplier = 1.0 - max_severity
    return max(ANOMALY_MULTIPLIER_FLOOR, multiplier)


def compute_supporter_contribution(
    *,
    has_verified_email: bool,
    severities: list[float],
    false_finding_count: int,
) -> tuple[float, float, float, float]:
    """Returns (contribution, trust, anomaly_multiplier, false_reliability)."""
    trust = BASE_TRUST + (SCHOOL_EMAIL_TRUST if has_verified_email else 0.0)
    anomaly_mult = compute_anomaly_multiplier(severities)
    false_rel = compute_false_reliability(false_finding_count)
    raw = trust * CONTRIBUTION_NORMALIZATION * anomaly_mult * false_rel
    contribution = min(PER_SUPPORTER_CAP, raw)
    return round(contribution, 4), round(trust, 2), round(anomaly_mult, 3), round(false_rel, 3)


@dataclass(frozen=True)
class SupporterInput:
    student_id: str
    role: str  # "reporter" or "confirmer"
    has_verified_email: bool
    anomaly_severities: list[float]
    false_finding_count: int
