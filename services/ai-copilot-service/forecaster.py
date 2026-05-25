import math
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────
#  Hiring demand forecast
# ──────────────────────────────────────────────

def forecast_hiring_demand(
    current_headcount: int,
    growth_rate: float,
    attrition_rate: float,
    months: int,
    department_breakdown: Optional[dict[str, int]] = None,
) -> list[dict]:
    now = datetime.now(timezone.utc)
    forecast: list[dict] = []
    headcount = float(current_headcount)

    for m in range(1, months + 1):
        # Monthly attrition and growth rates (compounded monthly)
        monthly_growth = (1 + growth_rate) ** (1 / 12) - 1
        monthly_attrition = (1 + attrition_rate) ** (1 / 12) - 1

        # Attrition happens first, then growth hiring
        month_attrition = int(round(headcount * monthly_attrition))
        headcount -= month_attrition

        # Growth hiring
        natural_change = headcount * monthly_growth
        new_hires = max(0, int(round(natural_change))) + max(0, month_attrition - int(round(natural_change * 0.5)))
        headcount += new_hires

        # Round headcount
        headcount = round(headcount)

        # Build month string
        month_date = now.replace(day=1) + timedelta(days=32 * m)
        month_str = month_date.strftime("%Y-%m")

        forecast.append({
            "month": month_str,
            "total": int(headcount),
            "new_hires": new_hires,
            "attrition": month_attrition,
        })

    return forecast


# ──────────────────────────────────────────────
#  Skill gap analysis
# ──────────────────────────────────────────────

def analyze_skill_gaps(
    current_skills: dict[str, int],
    target_skills: dict[str, int],
) -> dict:
    all_skills = set(current_skills.keys()) | set(target_skills.keys())
    gaps: list[dict] = []

    for skill in sorted(all_skills):
        current = current_skills.get(skill, 0)
        target = target_skills.get(skill, 0)
        gap = target - current

        if gap > 0:
            # Determine severity
            gap_pct = gap / max(target, 1)
            if gap_pct >= 0.5:
                severity = "HIGH"
            elif gap_pct >= 0.25:
                severity = "MEDIUM"
            else:
                severity = "LOW"

            gaps.append({
                "skill": skill,
                "current": current,
                "target": target,
                "gap": gap,
                "severity": severity,
            })

    # Generate recommendations
    recommendations: list[str] = []
    for g in gaps:
        if g["severity"] == "HIGH":
            recommendations.append(
                f"Urgently hire {g['gap']} {g['skill']} professionals"
            )
        elif g["severity"] == "MEDIUM":
            hire_count = max(1, g["gap"] // 2)
            train_count = g["gap"] - hire_count
            recommendations.append(
                f"Hire {hire_count} {g['skill']} experts and upskill {train_count} internal staff"
            )
        else:
            recommendations.append(
                f"Soften gap: cross-train {g['gap']} team members in {g['skill']}"
            )

    return {
        "gaps": gaps,
        "recommendations": recommendations,
    }


# ──────────────────────────────────────────────
#  Department growth projection
# ──────────────────────────────────────────────

def project_department_growth(months: int = 12) -> list[dict]:
    # Simulated department data based on typical org structure
    departments = [
        {"name": "Engineering", "current": 312, "growth_rate": 0.25},
        {"name": "Sales", "current": 198, "growth_rate": 0.18},
        {"name": "Marketing", "current": 87, "growth_rate": 0.15},
        {"name": "Product", "current": 94, "growth_rate": 0.22},
        {"name": "Operations", "current": 156, "growth_rate": 0.10},
        {"name": "Support", "current": 320, "growth_rate": 0.08},
        {"name": "HR", "current": 42, "growth_rate": 0.12},
        {"name": "Finance", "current": 38, "growth_rate": 0.08},
    ]

    results = []
    for dept in departments:
        current = dept["current"]
        annual_rate = dept["growth_rate"]
        # Compound monthly growth
        monthly_rate = (1 + annual_rate) ** (1 / 12) - 1
        projected = int(round(current * (1 + monthly_rate) ** months))
        growth_pct = round((projected - current) / current * 100, 1)

        results.append({
            "name": dept["name"],
            "current": current,
            "projected": projected,
            "growth_pct": growth_pct,
        })

    return results
