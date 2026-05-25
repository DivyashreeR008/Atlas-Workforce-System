import re
import logging
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────
#  Common tech skills lexicon
# ──────────────────────────────────────────────

_COMMON_SKILLS: list[str] = [
    "Python", "Java", "JavaScript", "TypeScript", "Go", "Rust", "C++", "C#",
    "Ruby", "PHP", "Swift", "Kotlin", "Scala", "Perl", "R", "MATLAB",
    "React", "Angular", "Vue.js", "Node.js", "Django", "Flask", "FastAPI",
    "Spring Boot", "ASP.NET", "Laravel", "Rails",
    "AWS", "Azure", "GCP", "Docker", "Kubernetes", "Terraform", "Ansible",
    "CI/CD", "Jenkins", "GitHub Actions", "GitLab CI",
    "PostgreSQL", "MySQL", "MongoDB", "Redis", "Elasticsearch", "Cassandra",
    "BigQuery", "Redshift", "Snowflake",
    "TensorFlow", "PyTorch", "scikit-learn", "Pandas", "NumPy", "Spark",
    "Kafka", "RabbitMQ", "Airflow", "dbt",
    "GraphQL", "REST", "gRPC", "WebSocket",
    "Agile", "Scrum", "Kanban", "JIRA", "Confluence",
    "Machine Learning", "Deep Learning", "NLP", "Computer Vision",
    "Data Engineering", "Data Science", "Data Analysis", "Data Warehousing",
    "DevOps", "SRE", "Cloud Architecture", "Microservices",
    "Tableau", "Power BI", "Looker", "Qlik",
    "Excel", "SQL", "NoSQL", "Git", "Linux", "Shell Scripting",
    "Project Management", "Product Management", "UX Design", "UI Design",
    "Figma", "Sketch", "Adobe XD", "Photoshop", "Illustrator",
    "SAP", "Salesforce", "Workday", "ServiceNow",
    "Jira", "Confluence", "Notion", "Asana", "Trello",
    "Leadership", "Communication", "Team Management", "Strategic Planning",
]

_SKILLS_SET: set[str] = {s.lower() for s in _COMMON_SKILLS}


# ──────────────────────────────────────────────
#  Pattern compilation
# ──────────────────────────────────────────────

_EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
_PHONE_RE = re.compile(r"(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}")
_NAME_RE = re.compile(
    r"(?:^|\n)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)",
)
_BULLET_RE = re.compile(r"(?:^|\n)\s*[\-\•\*]\s*(.+)", re.MULTILINE)

# ──────────────────────────────────────────────
#  Resume parsing
# ──────────────────────────────────────────────

def extract_skills(text: str) -> list[str]:
    """Extract known skills from text using case-insensitive matching."""
    found: set[str] = set()
    lower_text = text.lower()
    for skill in _COMMON_SKILLS:
        if skill.lower() in lower_text:
            found.add(skill)

    # Also check consecutive capitalized words that might be tech terms
    # e.g. "Amazon Web Services", "Google Cloud Platform"
    for match in re.finditer(r"(?:\b[A-Z][a-z]+\b\s*){2,4}", text):
        phrase = match.group(0).strip()
        if len(phrase) > 5 and phrase.lower() not in {s.lower() for s in found}:
            found.add(phrase)

    return sorted(found, key=lambda s: s.lower())


def extract_email(text: str) -> Optional[str]:
    match = _EMAIL_RE.search(text)
    return match.group(0) if match else None


def extract_phone(text: str) -> Optional[str]:
    match = _PHONE_RE.search(text)
    return match.group(0).strip() if match else None


def extract_name(text: str) -> Optional[str]:
    lines = text.strip().split("\n")
    for line in lines[:5]:
        line = line.strip()
        if not line:
            continue
        # Check if line looks like a name (2-4 capitalized words)
        words = line.split()
        if 2 <= len(words) <= 4:
            if all(w[0].isupper() and w.isalpha() for w in words if w):
                # Exclude common false positives
                if not any(
                    kw in line.lower()
                    for kw in ["resume", "curriculum", "vitae", "cv", "email", "phone", "address"]
                ):
                    return line
    return None


def extract_experience(text: str) -> list[dict]:
    """Extract work experience entries heuristically."""
    entries: list[dict] = []

    # Look for company-title patterns
    lines = text.split("\n")
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        year_range = re.search(
            r"(?:19|20)\d{2}\s*(?:–|-|to|–)\s*(?:(?:19|20)\d{2}|Present|Current|Now|Ongoing)",
            line,
            re.IGNORECASE,
        )
        if year_range and re.search(r"[A-Z]", line):
            title = None
            company = None
            years = 0

            start_str = year_range.group(0)
            parts = re.split(r"\s*(?:–|-|to|–)\s*", start_str, flags=re.IGNORECASE)
            if len(parts) == 2:
                try:
                    start_year = int(parts[0].strip())
                    end_str = parts[1].strip()
                    end_year = (
                        datetime.utcnow().year
                        if end_str.lower() in ("present", "current", "now", "ongoing")
                        else int(end_str)
                    )
                    years = end_year - start_year
                except (ValueError, IndexError):
                    pass

            # Look back up to 2 lines for title/company
            ctx_start = max(0, i - 2)
            for j in range(ctx_start, i):
                ctx_line = lines[j].strip()
                if ctx_line and not re.search(r"\d{4}", ctx_line):
                    if not title:
                        title = ctx_line
                    elif not company:
                        company = ctx_line

            if not company:
                # Try to find company name after "at" in the same line
                at_match = re.search(r"(?:at|@)\s+([A-Z][A-Za-z0-9\s&.]+)", line)
                if at_match:
                    company = at_match.group(1).strip()

            entries.append({
                "company": company,
                "title": title,
                "years": years,
            })
        i += 1

    return entries


def extract_education(text: str) -> list[dict]:
    """Extract education entries."""
    entries: list[dict] = []
    degree_keywords = [
        "bachelor", "master", "phd", "doctorate", "associate",
        "b.s.", "m.s.", "ph.d.", "b.a.", "m.a.", "mba", "btech", "mtech",
        "b.tech", "m.tech", "b.e.", "m.e.", "b.sc", "m.sc",
    ]

    lines = text.split("\n")
    for i, line in enumerate(lines):
        line = line.strip()
        has_degree = any(kw in line.lower() for kw in degree_keywords)
        has_year = re.search(r"(?:19|20)\d{2}", line)
        has_institution = re.search(
            r"(?:University|College|Institute|School|Academy)\s+of|of\s+(?:Technology|Science|Engineering|Arts)",
            line,
            re.IGNORECASE,
        )

        if (has_degree or (has_year and has_institution)):
            year = None
            ym = re.search(r"(?:19|20)\d{2}", line)
            if ym:
                year = int(ym.group(0))

            degree = None
            if has_degree:
                degree = line

            institution = None
            inst_match = re.search(
                r"((?:[A-Z][a-z]*\s+){1,4}(?:University|College|Institute|School|Academy))",
                line,
            )
            if inst_match:
                institution = inst_match.group(1).strip()

            if not institution and i + 1 < len(lines):
                next_line = lines[i + 1].strip()
                inst_match2 = re.search(
                    r"((?:[A-Z][a-z]*\s+){1,4}(?:University|College|Institute|School|Academy))",
                    next_line,
                )
                if inst_match2:
                    institution = inst_match2.group(1).strip()

            entries.append({
                "degree": degree,
                "institution": institution,
                "year": year,
            })

    return entries


def parse_resume(text: str) -> dict:
    return {
        "name": extract_name(text),
        "email": extract_email(text),
        "phone": extract_phone(text),
        "skills": extract_skills(text),
        "experience": extract_experience(text),
        "education": extract_education(text),
    }


# ──────────────────────────────────────────────
#  Resume scoring against job description
# ──────────────────────────────────────────────

_SOFT_SKILLS: set[str] = {
    "leadership", "communication", "teamwork", "problem solving",
    "critical thinking", "time management", "adaptability", "creativity",
    "collaboration", "interpersonal", "analytical", "detail-oriented",
    "self-motivated", "proactive", "flexible", "reliable",
    "presentation", "negotiation", "mentoring", "coaching",
    "conflict resolution", "decision making", "strategic thinking",
}


def score_resume(resume_text: str, job_description: str, job_requirements: list[str]) -> dict:
    resume_lower = resume_text.lower()
    job_lower = job_description.lower()

    # ── Skill extraction ──
    resume_skills = set(s.lower() for s in extract_skills(resume_text))
    job_skills = set()

    for req in job_requirements:
        job_skills.add(req.lower())

    if not job_skills:
        # Extract from job description
        for skill in _COMMON_SKILLS:
            if skill.lower() in job_lower:
                job_skills.add(skill.lower())

    matched = [s for s in _COMMON_SKILLS if s.lower() in resume_skills and s.lower() in job_skills]
    missing = [s for s in _COMMON_SKILLS if s.lower() not in resume_skills and s.lower() in job_skills]

    # ── Skill match score ──
    if job_skills:
        skill_match = len(matched) / max(len(job_skills), 1)
    else:
        skill_match = 0.5

    skill_match = min(1.0, skill_match)

    # ── Experience match ──
    # Look for experience-related keywords in resume and job
    exp_keywords = [
        "year", "experience", "senior", "lead", "manager", "director",
        "architect", "principal", "staff",
    ]
    resume_exp_count = sum(1 for kw in exp_keywords if kw in resume_lower)
    job_exp_count = sum(1 for kw in exp_keywords if kw in job_lower)

    if job_exp_count > 0:
        experience_match = min(1.0, resume_exp_count / max(job_exp_count, 1))
    else:
        experience_match = 0.6

    # ── Education match ──
    edu_keywords = [
        "bachelor", "master", "phd", "doctorate", "mba", "degree",
        "university", "college", "institute",
    ]
    resume_edu_count = sum(1 for kw in edu_keywords if kw in resume_lower)
    job_edu_count = sum(1 for kw in edu_keywords if kw in job_lower)

    if job_edu_count > 0:
        education_match = min(1.0, resume_edu_count / max(job_edu_count, 1))
    else:
        education_match = 0.7

    # ── Overall score (weighted) ──
    overall = skill_match * 0.50 + experience_match * 0.30 + education_match * 0.20

    # ── Summary ──
    summary_parts = []
    if skill_match > 0.7:
        summary_parts.append(f"Strong technical skill alignment ({len(matched)} of {len(job_skills)} required skills matched)")
    elif skill_match > 0.4:
        summary_parts.append(f"Moderate technical skill alignment with {len(missing)} missing skills")
    else:
        summary_parts.append(f"Limited technical skill alignment — {len(matched)} of {len(job_skills)} skills matched")

    if missing:
        summary_parts.append(f"Missing skills: {', '.join(missing[:5])}")
    if experience_match > 0.7:
        summary_parts.append("Experience level appears aligned with role requirements")
    else:
        summary_parts.append("Experience level may need review")

    return {
        "overall_score": round(overall, 2),
        "skill_match": round(skill_match, 2),
        "experience_match": round(experience_match, 2),
        "education_match": round(education_match, 2),
        "matched_skills": matched[:15],
        "missing_skills": missing[:15],
        "summary": ". ".join(summary_parts) + ".",
    }
