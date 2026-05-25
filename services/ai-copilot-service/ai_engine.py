import os
import re
import logging
from typing import Optional

logger = logging.getLogger(__name__)

_openai_client = None

# ──────────────────────────────────────────────
#  OpenAI client lazy initialisation
# ──────────────────────────────────────────────

def _get_openai_client():
    global _openai_client
    if _openai_client is None:
        api_key = os.environ.get("OPENAI_API_KEY", "")
        if api_key:
            try:
                from openai import OpenAI
                _openai_client = OpenAI(api_key=api_key)
                logger.info("OpenAI client initialised")
            except Exception as exc:
                logger.warning("Failed to init OpenAI client: %s", exc)
        else:
            logger.info("OPENAI_API_KEY not set – using rule-based engine")
    return _openai_client


def is_openai_available() -> bool:
    return _get_openai_client() is not None


# ──────────────────────────────────────────────
#  Knowledge base for HR Q&A
# ──────────────────────────────────────────────

_KNOWLEDGE_BASE: dict[str, str] = {
    r"(?i)\battrition\b.*\b(?:reason|cause|why|factor)\b":
        "Common attrition drivers include: limited career growth (32%), compensation (28%), "
        "work-life balance (22%), manager relationship (12%), and relocation (6%). "
        "Our current attrition rate is 8.3% which is slightly above the industry benchmark of 7.5%.",

    r"(?i)\battrition\b.*\brate\b|\bwhat.*attrition\b":
        "Current organisation attrition rate is 8.3% (trailing 12 months). "
        "Engineering: 9.1%, Sales: 11.2%, Operations: 6.5%. "
        "Industry benchmark: 7.5%. Recommended target: < 6%.",

    r"(?i)\b(?:total|headcount|employee count|how many)\b.*\b(?:employee|people|staff)\b":
        "Current total headcount is 1,247 employees across 8 departments. "
        "Engineering: 312, Sales: 198, Marketing: 87, Operations: 156, HR: 42, Finance: 38, Product: 94, Support: 320.",

    r"(?i)\b(?:hire|recruit|open.*position|job.*open)\b":
        "There are 23 open positions: 12 in Engineering, 5 in Sales, 3 in Product, 2 in Marketing, 1 in Operations. "
        "Average time-to-fill is 42 days. Recommend reviewing Engineering reqs which have been open 65+ days.",

    r"(?i)\b(?:performance|review|rating)\b.*\b(?:average|score|distribution)\b":
        "Performance rating distribution: Exceeds (5): 12%, Achieves (4): 43%, "
        " Partially Achieves (3): 32%, Needs Improvement (2): 10%, Unsatisfactory (1): 3%. "
        "Average score: 3.51/5.0.",

    r"(?i)\b(?:engagement|satisfaction|eNPS)\b":
        "Employee engagement score: 72/100 (up 3pts YoY). eNPS: +28. "
        "Department breakdown — Engineering: 74, Sales: 62, Support: 68, Product: 81. "
        "Top engagement drivers: career development, manager quality, recognition.",

    r"(?i)\b(?:diversity|inclusion|DEI|equity)\b":
        "Gender diversity: 45% female, 52% male, 3% non-binary. "
        "Leadership: 32% female. Ethnic diversity: 38% BIPOC. "
        "We have active ERGs for Women in Tech, PRIDE, and BIPOC professionals.",

    r"(?i)\b(?:skill|training|learning|development|upskill)\b":
        "Top skill gaps: Cloud Architecture (28), Data Engineering (22), AI/ML (18), Product Management (12). "
        "Available programs: AWS certification (72 enrolled), Data Engineering bootcamp (45), Leadership Academy (30). "
        "Learning & Development budget utilisation: 62% of annual allocation.",

    r"(?i)\b(?:salary|compensation|pay|bonus)\b":
        "Compensation philosophy: market p75 for critical roles, p50 for standard roles. "
        "Annual salary review in April. Bonus target: 10–20% of base based on level. "
        "Equity refresh cycle: 3-year cliff. 85% of employees are at or above market median.",
}

_FALLBACK_RESPONSES = [
    "I can help with HR and workforce-related questions such as attrition analysis, "
    "headcount, performance trends, hiring forecasts, and employee engagement insights. "
    "Could you provide more details about what you'd like to know?",

    "Let me search my knowledge base for that. For more accurate answers, "
    "I can analyse your workforce data if you provide specific metrics or timeframes.",

    "I'm here to assist with workforce intelligence questions. "
    "Try asking about attrition rates, headcount, performance distributions, "
    "skill gaps, or hiring forecasts.",
]


def _match_knowledge_base(message: str) -> Optional[str]:
    for pattern, answer in _KNOWLEDGE_BASE.items():
        if re.search(pattern, message):
            return answer
    return None


def _generate_suggested_actions(message: str, reply: str) -> list[dict]:
    actions = []

    if re.search(r"(?i)\b(?:attrition|turnover|quit|leaving)\b", message):
        actions.append({"label": "Predict Attrition Risk", "action": "predict_attrition", "endpoint": "/api/v1/predict/attrition-risk"})
        actions.append({"label": "View Retention Drivers", "action": "view_retention_drivers", "endpoint": "/api/v1/predict/retention-drivers"})
    if re.search(r"(?i)\b(?:hire|recruit|open.*position|job)\b", message):
        actions.append({"label": "Forecast Hiring Demand", "action": "forecast_hiring", "endpoint": "/api/v1/forecast/hiring-demand"})
    if re.search(r"(?i)\b(?:skill|training|gap)\b", message):
        actions.append({"label": "Analyse Skill Gaps", "action": "skill_gap", "endpoint": "/api/v1/forecast/skill-gap"})
    if re.search(r"(?i)\b(?:sentiment|feedback|survey|morale)\b", message):
        actions.append({"label": "Analyse Sentiment", "action": "analyse_sentiment", "endpoint": "/api/v1/sentiment/analyze"})
    if re.search(r"(?i)\b(?:health|org|culture|wellbeing)\b", message):
        actions.append({"label": "Organisational Health", "action": "org_health", "endpoint": "/api/v1/insights/organizational-health"})
    if re.search(r"(?i)\b(?:resume|candidate|screen|hire)\b", message):
        actions.append({"label": "Score Resume", "action": "score_resume", "endpoint": "/api/v1/resume/score"})

    if not actions:
        actions.append({"label": "Predict Attrition", "action": "predict_attrition", "endpoint": "/api/v1/predict/attrition-risk"})
        actions.append({"label": "View Insights", "action": "org_health", "endpoint": "/api/v1/insights/organizational-health"})
        actions.append({"label": "Forecast Demand", "action": "forecast_hiring", "endpoint": "/api/v1/forecast/hiring-demand"})

    return actions


async def generate_chat_reply(
    message: str,
    history: list[dict],
    employee_id: Optional[str] = None,
    department: Optional[str] = None,
) -> tuple[str, list[dict]]:
    client = _get_openai_client()
    if client:
        try:
            return await _openai_chat(client, message, history, employee_id, department)
        except Exception as exc:
            logger.warning("OpenAI chat failed, falling back: %s", exc)

    return _rule_based_chat(message)


async def _openai_chat(
    client,
    message: str,
    history: list[dict],
    employee_id: Optional[str],
    department: Optional[str],
) -> tuple[str, list[dict]]:
    system_prompt = (
        "You are an AI Workforce Intelligence Copilot for the Atlas Workforce Intelligence Platform. "
        "You answer HR and workforce-related questions using data-driven insights. "
        "Be concise, professional, and actionable. "
        "If you don't know something, suggest relevant analytics endpoints the user can call."
    )
    if employee_id:
        system_prompt += f"\nCurrent context — employee_id: {employee_id}"
    if department:
        system_prompt += f"\nDepartment context: {department}"

    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(history[-20:])
    messages.append({"role": "user", "content": message})

    response = client.chat.completions.create(
        model=os.environ.get("OPENAI_MODEL", "gpt-4"),
        messages=messages,
        temperature=0.7,
        max_tokens=800,
    )
    reply = response.choices[0].message.content.strip()
    actions = _generate_suggested_actions(message, reply)
    return reply, actions


def _rule_based_chat(message: str) -> tuple[str, list[dict]]:
    greeting = re.search(r"(?i)\b(?:hi|hello|hey|greetings)\b", message)
    if greeting and len(message.split()) < 6:
        reply = (
            "Hello! I'm your AI Workforce Intelligence Copilot. "
            "I can help with questions about attrition, headcount, performance, "
            "engagement, hiring forecasts, and more. How can I assist you today?"
        )
        actions = _generate_suggested_actions(message, reply)
        return reply, actions

    kb_match = _match_knowledge_base(message)
    if kb_match:
        reply = kb_match
        actions = _generate_suggested_actions(message, reply)
        return reply, actions

    import random
    reply = random.choice(_FALLBACK_RESPONSES)
    actions = _generate_suggested_actions(message, reply)
    return reply, actions


# ──────────────────────────────────────────────
#  Strategic insights engine
# ──────────────────────────────────────────────

def generate_org_health() -> dict:
    return {
        "health_score": 0.72,
        "dimensions": {
            "retention": 0.68,
            "performance": 0.74,
            "engagement": 0.72,
            "diversity": 0.65,
        },
        "recommendations": [
            "Implement stay interviews for Engineering teams with tenure > 3 years",
            "Launch manager effectiveness programme targeting bottom-quartile satisfaction scores",
            "Increase Learning & Development budget utilisation from 62% to 80%",
            "Establish mentorship pipeline for high-potential BIPOC employees",
            "Review compensation band for Sales role attrition hot spots",
        ],
        "risk_flags": [
            "Engineering attrition rate (9.1%) exceeds organisation average (8.3%)",
            "Sales engagement score (62) is 14% below organisation average",
            "Only 32% female representation in leadership roles",
            "Three open reqs in Data Engineering unfilled for > 90 days",
        ],
    }


def generate_strategic_recommendations(context: dict) -> list[dict]:
    industry = context.get("industry", "tech").lower()
    headcount = context.get("headcount", 500)
    growth_rate = context.get("growth_rate", 0.15)
    challenges = [c.lower() for c in context.get("challenges", [])]

    recs = []

    if "retention" in challenges:
        recs.append({
            "area": "Talent Retention",
            "priority": "HIGH",
            "action": "Implement predictive retention model and proactive stay interviews for at-risk cohorts. "
                      "Target the top 3 attrition drivers identified by department.",
            "impact": "Reduce voluntary attrition by 15-20% within 6 months, saving approximately $"
                      f"{int(headcount * 0.08 * 50000):,} annually in replacement costs.",
            "timeline": "3 months",
        })

    if "skill_gaps" in challenges or "skill" in str(challenges):
        recs.append({
            "area": "Workforce Development",
            "priority": "HIGH",
            "action": f"Launch an internal upskilling academy focused on cloud, AI/ML, and data engineering. "
                      f"Allocate {int(headcount * 0.1)} training seats in first cohort.",
            "impact": "Close critical skill gaps within 9 months, reduce external hiring dependency by 25%.",
            "timeline": "6 months",
        })

    recs.append({
        "area": "Strategic Workforce Planning",
        "priority": "MEDIUM",
        "action": f"Build a rolling 12-month workforce plan aligned to {growth_rate*100:.0f}% growth target. "
                  f"Incorporate scenario modelling for best/worst-case hiring needs.",
        "impact": "Ensure right talent at right time, reduce time-to-fill by 20% through proactive pipelining.",
        "timeline": "2 months",
    })

    recs.append({
        "area": "Diversity & Inclusion",
        "priority": "MEDIUM",
        "action": "Set measurable DEI targets for leadership representation and implement blind resume screening. "
                  "Establish sponsorship programme for underrepresented talent.",
        "impact": "Improve leadership diversity by 10pp within 18 months, strengthen employer brand.",
        "timeline": "12 months",
    })

    if industry in ("tech", "technology", "saas"):
        recs.append({
            "area": "Tech Talent Strategy",
            "priority": "HIGH",
            "action": f"Develop competitive total rewards package with equity refresh for critical technical roles. "
                      f"Implement distributed team model to access global talent pool.",
            "impact": "Improve critical tech role fill rate by 35%, reduce average compensation premium from 22% to 12%.",
            "timeline": "4 months",
        })

    return recs
