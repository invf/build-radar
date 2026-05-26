"""AI analysis engine for construction objects."""
from __future__ import annotations
import json
import logging
from datetime import datetime, timezone

from .client import get_ai_client
from .prompts import OPPORTUNITY_ANALYSIS_PROMPT

logger = logging.getLogger(__name__)


def _build_object_context(obj) -> str:
    """Build a text description of a construction object for AI prompt."""
    parts = [
        f"Назва: {obj.name}",
        f"Місто: {obj.city or 'невідомо'}",
        f"Область: {obj.oblast or 'невідомо'}",
        f"Адреса: {obj.address or 'невідомо'}",
        f"Статус: {obj.status}",
        f"Категорія: {obj.category or 'невідомо'}",
        f"Тип об'єкту: {obj.object_type or 'невідомо'}",
    ]

    if obj.floors:
        parts.append(f"Кількість поверхів: {obj.floors}")
    if obj.building_area:
        parts.append(f"Площа будівлі: {obj.building_area} м²")
    if obj.land_area:
        parts.append(f"Площа ділянки: {obj.land_area} м²")
    if obj.description:
        parts.append(f"Опис: {obj.description[:500]}")
    if obj.planned_completion:
        parts.append(f"Планове завершення: {obj.planned_completion.strftime('%Y-%m-%d')}")

    # Add company info if available
    if hasattr(obj, 'companies') and obj.companies:
        for oc in obj.companies[:3]:
            if hasattr(oc, 'company'):
                parts.append(f"Компанія ({oc.role}): {oc.company.name}")

    return "\n".join(parts)


async def analyze_object(obj, db) -> dict | None:
    """
    Run AI opportunity analysis on a construction object.
    Returns structured analysis dict.
    """
    from sqlalchemy import select
    from ..models.ai_analysis import AIAnalysis

    try:
        client = get_ai_client()
        object_context = _build_object_context(obj)
        prompt = OPPORTUNITY_ANALYSIS_PROMPT.format(object_data=object_context)

        response = await client.complete(prompt, max_tokens=1000)

        # Parse JSON response
        try:
            analysis_data = json.loads(response)
        except json.JSONDecodeError:
            # Try to extract JSON from response
            import re
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                analysis_data = json.loads(json_match.group())
            else:
                logger.error(f"Could not parse AI response for object {obj.id}")
                return None

        # Validate and clamp scores
        score = float(analysis_data.get("score", 0.5))
        score = max(0.0, min(1.0, score))

        hvac = float(analysis_data.get("hvac_opportunity", 0.5))
        hvac = max(0.0, min(1.0, hvac))

        itp = float(analysis_data.get("itp_opportunity", 0.5))
        itp = max(0.0, min(1.0, itp))

        # Save to database
        analysis = AIAnalysis(
            object_id=obj.id,
            analysis_type="opportunity_analysis",
            summary=analysis_data.get("summary"),
            hvac_opportunity=hvac,
            itp_opportunity=itp,
            engineering_complexity=analysis_data.get("engineering_complexity"),
            estimated_budget_uah=analysis_data.get("estimated_budget_uah"),
            opportunity_insights=analysis_data.get("opportunity_insights", []),
            recommended_actions=analysis_data.get("recommended_actions", []),
            content=analysis_data,
            score=score,
            model_version=client.model_name,
        )
        db.add(analysis)

        # Update object AI score
        obj.ai_score = score
        obj.ai_summary = analysis_data.get("summary", "")[:500]

        await db.commit()
        return analysis_data

    except Exception as e:
        logger.exception(f"AI analysis failed for object {obj.id}: {e}")
        return None


async def batch_analyze_objects(db, limit: int = 50, min_score_threshold: float = 0.0):
    """
    Batch analyze construction objects that haven't been analyzed yet.
    Runs in background as Celery task.
    """
    from sqlalchemy import select, and_
    from ..models.construction_object import ConstructionObject, ObjectStatus
    from ..models.ai_analysis import AIAnalysis
    from sqlalchemy.orm import selectinload

    # Find objects without AI analysis
    analyzed_ids = select(AIAnalysis.object_id)
    query = (
        select(ConstructionObject)
        .options(selectinload(ConstructionObject.companies))
        .where(
            and_(
                ConstructionObject.id.not_in(analyzed_ids),
                ConstructionObject.status.in_([
                    ObjectStatus.under_construction,
                    ObjectStatus.approved,
                    ObjectStatus.planned,
                ])
            )
        )
        .order_by(ConstructionObject.created_at.desc())
        .limit(limit)
    )

    result = await db.execute(query)
    objects = result.scalars().all()

    analyzed = 0
    for obj in objects:
        result = await analyze_object(obj, db)
        if result:
            analyzed += 1
        import asyncio
        await asyncio.sleep(0.5)  # Rate limiting

    logger.info(f"Batch analysis complete: {analyzed}/{len(objects)} objects analyzed")
    return analyzed
