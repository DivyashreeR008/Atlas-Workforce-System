import math
import logging
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)


# ══════════════════════════════════════════════
#  Attrition Risk Scoring
# ══════════════════════════════════════════════

# Feature weights derived from HR analytics research
_ATTRITION_WEIGHTS: dict[str, float] = {
    "satisfaction_score": 0.30,
    "tenure_years": 0.18,
    "overtime_hours": 0.16,
    "performance_score": 0.12,
    "absences": 0.10,
    "promotions": 0.08,
    "age": 0.06,
}

_DEPARTMENT_RISK_MODIFIERS: dict[str, float] = {
    "engineering": 0.05,
    "sales": 0.10,
    "support": 0.03,
    "operations": -0.02,
    "hr": -0.05,
    "finance": -0.03,
    "marketing": 0.02,
    "product": 0.04,
}

# Risk factor descriptions for interpretability
_RISK_FACTOR_LABELS: dict[str, str] = {
    "satisfaction_score": "Low satisfaction score",
    "tenure_years": "Short tenure (under 2 years) or long tenure (over 10 years)",
    "overtime_hours": "Excessive overtime hours",
    "performance_score": "Below-target performance rating",
    "absences": "High absenteeism",
    "promotions": "Lack of career progression",
    "age": "Younger age demographic risk factor",
}


def compute_attrition_risk(employee: dict[str, Any]) -> dict[str, Any]:
    emp_id = employee.get("employee_id", "unknown")
    department = (employee.get("department") or "").lower()

    score = 0.0
    factors: list[tuple[str, float]] = []

    # Satisfaction (0-1 scale, lower = higher risk)
    sat = float(employee.get("satisfaction_score", 0.5))
    sat_risk = 1.0 - sat
    w_sat = _ATTRITION_WEIGHTS["satisfaction_score"]
    score += sat_risk * w_sat
    if sat_risk > 0.5:
        factors.append((_RISK_FACTOR_LABELS["satisfaction_score"], sat_risk * w_sat))

    # Tenure (U-shaped risk: high in first 2 years, lower 3-8, rises again after 10)
    tenure = float(employee.get("tenure_years", 0))
    if tenure < 2:
        tenure_risk = 0.7 * (1.0 - tenure / 2.0)
    elif tenure < 8:
        tenure_risk = 0.2 * (tenure / 8.0)
    else:
        tenure_risk = min(1.0, 0.3 + 0.07 * (tenure - 8))
    w_ten = _ATTRITION_WEIGHTS["tenure_years"]
    score += tenure_risk * w_ten
    if tenure_risk > 0.5:
        factors.append((_RISK_FACTOR_LABELS["tenure_years"], tenure_risk * w_ten))

    # Overtime (hours per week beyond 40)
    ot = float(employee.get("overtime_hours", 0))
    ot_risk = min(1.0, ot / 30.0)
    w_ot = _ATTRITION_WEIGHTS["overtime_hours"]
    score += ot_risk * w_ot
    if ot_risk > 0.5:
        factors.append((_RISK_FACTOR_LABELS["overtime_hours"], ot_risk * w_ot))

    # Performance (0-1 scale, inverted U: very low and very high performers leave more)
    perf = float(employee.get("performance_score", 0.5))
    perf_risk = 1.0 - 2.0 * abs(perf - 0.5)
    w_perf = _ATTRITION_WEIGHTS["performance_score"]
    score += perf_risk * w_perf
    if perf_risk > 0.5:
        factors.append((_RISK_FACTOR_LABELS["performance_score"], perf_risk * w_perf))

    # Absences (days per year)
    absences = int(employee.get("absences", 0))
    abs_risk = min(1.0, absences / 15.0)
    w_abs = _ATTRITION_WEIGHTS["absences"]
    score += abs_risk * w_abs
    if abs_risk > 0.5:
        factors.append((_RISK_FACTOR_LABELS["absences"], abs_risk * w_abs))

    # Promotions (less promotions = higher risk)
    promos = int(employee.get("promotions", 0))
    promos_risk = max(0.0, 1.0 - promos / 3.0)
    w_prom = _ATTRITION_WEIGHTS["promotions"]
    score += promos_risk * w_prom
    if promos_risk > 0.5:
        factors.append((_RISK_FACTOR_LABELS["promotions"], promos_risk * w_prom))

    # Age (younger employees have higher risk)
    age = float(employee.get("age", 30))
    age_risk = max(0.0, 1.0 - (age - 20) / 40.0) if age < 50 else 0.2
    w_age = _ATTRITION_WEIGHTS["age"]
    score += age_risk * w_age
    if age_risk > 0.5:
        factors.append((_RISK_FACTOR_LABELS["age"], age_risk * w_age))

    # Department modifier
    dept_mod = _DEPARTMENT_RISK_MODIFIERS.get(department, 0.0)
    score += dept_mod * 0.1

    # Clamp
    risk_score = max(0.0, min(1.0, score))

    # Risk level
    if risk_score >= 0.75:
        risk_level = "CRITICAL"
    elif risk_score >= 0.55:
        risk_level = "HIGH"
    elif risk_score >= 0.35:
        risk_level = "MEDIUM"
    else:
        risk_level = "LOW"

    # Top factors (sorted by weight * contribution)
    factors.sort(key=lambda x: x[1], reverse=True)
    top_factors = [f[0] for f in factors[:3]]

    return {
        "employee_id": emp_id,
        "risk_score": round(risk_score, 4),
        "risk_level": risk_level,
        "top_factors": top_factors,
    }


# ══════════════════════════════════════════════
#  Performance Prediction (trend projection)
# ══════════════════════════════════════════════

def predict_performance(
    historical_scores: list[float],
    months_ahead: int,
) -> dict:
    if len(historical_scores) < 2:
        avg = historical_scores[-1] if historical_scores else 3.0
        predicted = [round(avg, 2)] * months_ahead
        return {
            "predicted_scores": predicted,
            "confidence_interval": {"lower": round(avg - 0.5, 2), "upper": round(avg + 0.5, 2)},
        }

    scores = np.array(historical_scores, dtype=float)

    # Linear regression via least squares: x = months, y = scores
    n = len(scores)
    x = np.arange(n, dtype=float)
    A = np.vstack([x, np.ones(n)]).T
    slope, intercept = np.linalg.lstsq(A, scores, rcond=None)[0]

    # Predict future months
    future_x = np.arange(n, n + months_ahead, dtype=float)
    predicted = intercept + slope * future_x

    # Clamp to valid range [1.0, 5.0]
    predicted = np.clip(predicted, 1.0, 5.0)
    predicted_list = [round(float(v), 2) for v in predicted]

    # Confidence interval based on residual std
    residuals = scores - (intercept + slope * x)
    residual_std = float(np.std(residuals)) if len(residuals) > 1 else 0.1
    margin = 1.96 * residual_std * math.sqrt(1 + 1 / n)  # 95% prediction interval

    last_pred = predicted_list[-1]
    return {
        "predicted_scores": predicted_list,
        "confidence_interval": {
            "lower": round(max(1.0, last_pred - margin), 2),
            "upper": round(min(5.0, last_pred + margin), 2),
        },
    }


# ══════════════════════════════════════════════
#  Retention Drivers (fixed model coefficients)
# ══════════════════════════════════════════════

_RETENTION_DRIVERS: list[dict[str, float]] = [
    {"factor": "manager_support", "weight": 0.85},
    {"factor": "career_growth_opportunities", "weight": 0.82},
    {"factor": "compensation_equity", "weight": 0.78},
    {"factor": "work_life_balance", "weight": 0.74},
    {"factor": "recognition_and_rewards", "weight": 0.68},
    {"factor": "job_security", "weight": 0.62},
    {"factor": "team_culture", "weight": 0.60},
    {"factor": "learning_and_development", "weight": 0.58},
    {"factor": "autonomy_and_empowerment", "weight": 0.52},
    {"factor": "company_reputation", "weight": 0.45},
]


def get_retention_drivers() -> list[dict]:
    return _RETENTION_DRIVERS
