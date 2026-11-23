from datetime import date
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def get_public_dashboard_metrics(
    session: AsyncSession,
    *,
    faculty_id: UUID | None = None,
    department_id: UUID | None = None,
    category: str | None = None,
    start_month: date | None = None,
    end_month: date | None = None,
) -> list[dict[str, Any]]:
    """Retrieve aggregate findings from public_dashboard view with suppression.
    
    Guarantees k-anonymity: individual findings, student identities, lecturer names,
    and groups smaller than platform_settings.dashboard_min_group are excluded by SQL.
    """
    conditions = ["1=1"]
    params: dict[str, Any] = {}

    if faculty_id is not None:
        conditions.append("d.faculty_id = :faculty_id")
        params["faculty_id"] = faculty_id

    if department_id is not None:
        conditions.append("pd.department_id = :department_id")
        params["department_id"] = department_id

    if category is not None:
        conditions.append("pd.category = :category")
        params["category"] = category

    if start_month is not None:
        conditions.append("pd.month >= :start_month")
        params["start_month"] = start_month

    if end_month is not None:
        conditions.append("pd.month <= :end_month")
        params["end_month"] = end_month

    where_clause = " AND ".join(conditions)

    query = text(
        f"""
        SELECT pd.department_id,
               pd.department,
               pd.category,
               pd.month,
               pd.findings
        FROM public_dashboard pd
        JOIN departments d ON d.id = pd.department_id
        WHERE {where_clause}
        ORDER BY pd.month DESC, pd.department ASC, pd.category ASC
        """
    )

    result = await session.execute(query, params)
    rows = result.mappings().all()

    return [
        {
            "department_id": str(r["department_id"]),
            "department": r["department"],
            "category": r["category"],
            "month": r["month"].isoformat() if hasattr(r["month"], "isoformat") else str(r["month"]),
            "findings": int(r["findings"]),
        }
        for r in rows
    ]
