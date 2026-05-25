from pydantic import BaseModel, Field
from typing import Optional

# ──────────────────────────────────────────────
#  Copilot / Chat
# ──────────────────────────────────────────────

class ChatContext(BaseModel):
    employee_id: Optional[str] = None
    department: Optional[str] = None


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    session_id: Optional[str] = None
    context: Optional[ChatContext] = None


class SuggestedAction(BaseModel):
    label: str
    action: str
    endpoint: Optional[str] = None


class ChatResponse(BaseModel):
    reply: str
    suggested_actions: list
    session_id: str


class ChatMessage(BaseModel):
    role: str
    content: str
    timestamp: Optional[str] = None


class SessionHistory(BaseModel):
    session_id: str
    messages: list[ChatMessage]


# ──────────────────────────────────────────────
#  Predictive Analytics
# ──────────────────────────────────────────────

class EmployeeRiskInput(BaseModel):
    employee_id: str
    department: Optional[str] = None
    tenure_years: float = 0
    age: float = 0
    satisfaction_score: float = 0.5
    performance_score: float = 0.5
    overtime_hours: float = 0
    promotions: int = 0
    absences: int = 0


class AttritionRiskRequest(BaseModel):
    employees: list[EmployeeRiskInput]


class RiskPrediction(BaseModel):
    employee_id: str
    risk_score: float
    risk_level: str
    top_factors: list[str]


class AttritionRiskResponse(BaseModel):
    predictions: list[RiskPrediction]


class PerformancePredictionRequest(BaseModel):
    employee_id: str
    historical_scores: list[float]
    months_ahead: int = Field(default=2, ge=1, le=12)


class ConfidenceInterval(BaseModel):
    lower: float
    upper: float


class PerformancePredictionResponse(BaseModel):
    predicted_scores: list[float]
    confidence_interval: ConfidenceInterval


class RetentionDriver(BaseModel):
    factor: str
    weight: float


class RetentionDriversResponse(BaseModel):
    drivers: list[RetentionDriver]


# ──────────────────────────────────────────────
#  Workforce Forecasting
# ──────────────────────────────────────────────

class HiringDemandRequest(BaseModel):
    current_headcount: int = Field(..., gt=0)
    growth_rate: float = 0.0
    attrition_rate: float = 0.0
    months: int = Field(default=12, ge=1, le=60)
    department_breakdown: Optional[dict] = None


class MonthlyForecast(BaseModel):
    month: str
    total: int
    new_hires: int
    attrition: int


class HiringDemandResponse(BaseModel):
    forecast: list[MonthlyForecast]


class SkillGapRequest(BaseModel):
    current_skills: dict[str, int]
    target_skills: dict[str, int]


class SkillGap(BaseModel):
    skill: str
    current: int
    target: int
    gap: int
    severity: str


class SkillGapResponse(BaseModel):
    gaps: list[SkillGap]
    recommendations: list[str]


class DepartmentGrowth(BaseModel):
    name: str
    current: int
    projected: int
    growth_pct: float


class DepartmentGrowthResponse(BaseModel):
    departments: list[DepartmentGrowth]


# ──────────────────────────────────────────────
#  Resume Screening
# ──────────────────────────────────────────────

class ResumeScoreRequest(BaseModel):
    resume_text: str = Field(..., min_length=10)
    job_description: str = Field(..., min_length=10)
    job_requirements: list[str] = Field(default_factory=list)


class ResumeScoreResponse(BaseModel):
    overall_score: float
    skill_match: float
    experience_match: float
    education_match: float
    matched_skills: list[str]
    missing_skills: list[str]
    summary: str


class ResumeAnalyzeRequest(BaseModel):
    resume_text: str = Field(..., min_length=10)


class ExperienceEntry(BaseModel):
    company: Optional[str] = None
    title: Optional[str] = None
    years: Optional[float] = None


class EducationEntry(BaseModel):
    degree: Optional[str] = None
    institution: Optional[str] = None
    year: Optional[int] = None


class ResumeAnalyzeResponse(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    skills: list[str]
    experience: list[ExperienceEntry]
    education: list[EducationEntry]


# ──────────────────────────────────────────────
#  Sentiment Analysis
# ──────────────────────────────────────────────

class SentimentAnalyzeRequest(BaseModel):
    text: str = Field(..., min_length=1)
    context: Optional[str] = None


class Emotions(BaseModel):
    satisfaction: float = 0.0
    frustration: float = 0.0
    engagement: float = 0.0
    confidence: float = 0.0


class SentimentAnalyzeResponse(BaseModel):
    sentiment: str
    score: float
    emotions: Emotions
    key_phrases: list[str]
    summary: str


class SurveyAnswerInput(BaseModel):
    employee_id: Optional[str] = None
    question_id: Optional[str] = None
    answer_text: str
    rating: Optional[int] = None


class SurveyRequest(BaseModel):
    responses: list[SurveyAnswerInput]


class SurveyCategories(BaseModel):
    culture: Optional[float] = None
    management: Optional[float] = None
    compensation: Optional[float] = None
    work_life_balance: Optional[float] = None
    career_growth: Optional[float] = None


class SurveyAnalysisResponse(BaseModel):
    overall_sentiment: float
    categories: SurveyCategories
    trend: str
    highlights: list[str]
    concerns: list[str]


# ──────────────────────────────────────────────
#  Strategic Insights
# ──────────────────────────────────────────────

class OrgHealthDimension(BaseModel):
    retention: Optional[float] = None
    performance: Optional[float] = None
    engagement: Optional[float] = None
    diversity: Optional[float] = None


class OrgHealthResponse(BaseModel):
    health_score: float
    dimensions: OrgHealthDimension
    recommendations: list[str]
    risk_flags: list[str]


class StrategicContext(BaseModel):
    industry: Optional[str] = None
    headcount: Optional[int] = None
    growth_rate: Optional[float] = None
    challenges: list[str] = Field(default_factory=list)


class StrategicRecommendationRequest(BaseModel):
    context: StrategicContext


class RecommendationItem(BaseModel):
    area: str
    priority: str
    action: str
    impact: str
    timeline: str


class StrategicRecommendationResponse(BaseModel):
    recommendations: list[RecommendationItem]
