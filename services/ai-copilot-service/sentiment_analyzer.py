import re
import math
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────
#  Sentiment lexicon scoring
# ──────────────────────────────────────────────

_POSITIVE_WORDS: set[str] = {
    "excellent", "great", "good", "outstanding", "fantastic", "wonderful",
    "amazing", "superb", "impressive", "exceptional", "brilliant", "love",
    "happy", "pleased", "satisfied", "grateful", "appreciate", "thankful",
    "positive", "optimistic", "encouraging", "inspiring", "motivated",
    "engaged", "supported", "valued", "recognized", "rewarded",
    "collaborative", "innovative", "productive", "efficient", "effective",
    "improving", "growing", "thriving", "flourishing", "beneficial",
    "helpful", "clear", "transparent", "fair", "respectful", "inclusive",
    "empowered", "confident", "enthusiastic", "passionate", "committed",
    "dedicated", "loyal", "proud", "accomplished", "successful",
    "friendly", "supportive", "flexible", "balanced", "healthy",
    "fun", "exciting", "rewarding", "fulfilling", "meaningful",
}

_NEGATIVE_WORDS: set[str] = {
    "terrible", "horrible", "awful", "poor", "bad", "worst", "hate",
    "dislike", "disappointed", "frustrated", "annoyed", "angry", "upset",
    "unhappy", "dissatisfied", "unpleasant", "miserable", "depressing",
    "negative", "pessimistic", "discouraging", "demotivating", "disengaged",
    "burnout", "burned out", "exhausted", "overworked", "stressed",
    "toxic", "hostile", "unfair", "biased", "unethical", "dishonest",
    "unclear", "confusing", "disorganized", "chaotic", "inefficient",
    "declining", "failing", "struggling", "worsening", "problematic",
    "difficult", "challenging", "stressful", "unstable", "uncertain",
    "isolated", "ignored", "neglected", "undervalued", "underpaid",
    "overwhelmed", "anxious", "worried", "concerned", "frustrating",
    "bureaucratic", "siloed", "micromanaged", "mistrust", "distrust",
}

_INTENSIFIERS: set[str] = {
    "very", "extremely", "incredibly", "highly", "really", "absolutely",
    "utterly", "completely", "totally", "deeply", "truly", "especially",
    "particularly", "remarkably", "exceptionally",
}

_NEGATORS: set[str] = {
    "not", "no", "never", "neither", "nor", "none", "nobody", "nothing",
    "hardly", "barely", "scarcely", "doesn't", "don't", "didn't",
    "won't", "wouldn't", "couldn't", "shouldn't", "isn't", "aren't",
    "wasn't", "weren't", "haven't", "hasn't", "hadn't", "can't",
    "cannot",
}

# ──────────────────────────────────────────────
#  Emotion dimension lexicons
# ──────────────────────────────────────────────

_SATISFACTION_WORDS: set[str] = {
    "satisfied", "happy", "pleased", "content", "fulfilled", "grateful",
    "appreciate", "rewarding", "meaningful", "valued",
}

_FRUSTRATION_WORDS: set[str] = {
    "frustrated", "annoyed", "irritated", "aggravated", "exasperated",
    "frustrating", "frustration", "roadblock", "bottleneck", "slow",
    "unclear", "confusing", "waste", "unnecessary", "redundant",
}

_ENGAGEMENT_WORDS: set[str] = {
    "engaged", "excited", "motivated", "inspired", "enthusiastic",
    "passionate", "committed", "involved", "participate", "contribute",
    "challenged", "growing", "learning", "initiative", "ownership",
}

_CONFIDENCE_WORDS: set[str] = {
    "confident", "certain", "sure", "trust", "believe", "convinced",
    "assured", "positive", "optimistic", "hopeful", "strong",
}

# ──────────────────────────────────────────────
#  Key phrase extraction
# ──────────────────────────────────────────────

_BIGRAM_PATTERNS = [
    (re.compile(r"(?i)(lack of \w+)"), 0.8),
    (re.compile(r"(?i)(need (?:more|better|improved) \w+)"), 0.8),
    (re.compile(r"(?i)((?:great|excellent|outstanding) \w+)"), 0.7),
    (re.compile(r"(?i)((?:poor|terrible|bad) \w+)"), 0.7),
    (re.compile(r"(?i)((?:really|very|extremely) \w+)"), 0.5),
    (re.compile(r"(?i)(\w+ (?:is|are) (?:great|poor|good|bad))"), 0.6),
]


def _score_lexicon(text: str) -> tuple[float, int, int, float, float, float, float]:
    """Tokenise and score text against sentiment lexicons.

    Returns:
        (sentiment_score, pos_count, neg_count, satisfaction, frustration, engagement, confidence)
    """
    tokens = re.findall(r"[a-z']+", text.lower())

    pos_count = 0
    neg_count = 0
    total_score = 0.0
    i = 0

    sat_count = 0
    fru_count = 0
    eng_count = 0
    con_count = 0

    while i < len(tokens):
        token = tokens[i]

        # Check bigrams first
        bigram = f"{token} {tokens[i + 1]}" if i + 1 < len(tokens) else ""

        # Negation handling: check if previous token is a negator
        negation = i > 0 and tokens[i - 1] in _NEGATORS

        # Intensifier
        intensifier = token in _INTENSIFIERS

        multiplier = 1.0
        if negation:
            multiplier = -0.5
        if intensifier:
            multiplier *= 1.5

        if token in _POSITIVE_WORDS or bigram in _POSITIVE_WORDS:
            pos_count += 1
            total_score += 1.0 * multiplier
        elif token in _NEGATIVE_WORDS or bigram in _NEGATIVE_WORDS:
            neg_count += 1
            total_score -= 1.0 * multiplier

        # Emotion dimensions
        if token in _SATISFACTION_WORDS or bigram in _SATISFACTION_WORDS:
            sat_count += 1
        if token in _FRUSTRATION_WORDS or bigram in _FRUSTRATION_WORDS:
            fru_count += 1
        if token in _ENGAGEMENT_WORDS or bigram in _ENGAGEMENT_WORDS:
            eng_count += 1
        if token in _CONFIDENCE_WORDS or bigram in _CONFIDENCE_WORDS:
            con_count += 1

        i += 1

    # Normalise score to 0-1
    max_possible = max(pos_count + neg_count, 1)
    raw = total_score / math.sqrt(max_possible)
    score = (math.tanh(raw) + 1.0) / 2.0  # squash to [0, 1]

    # Emotion dimension scores (normalised)
    total_tokens = max(len(tokens), 1)

    def _norm(count: int) -> float:
        return round(min(1.0, count / (total_tokens * 0.1)), 2)

    return (
        round(score, 4),
        pos_count,
        neg_count,
        _norm(sat_count),
        _norm(fru_count),
        _norm(eng_count),
        _norm(con_count),
    )


def _extract_key_phrases(text: str) -> list[str]:
    phrases: list[str] = []
    seen: set[str] = set()
    for pattern, _ in _BIGRAM_PATTERNS:
        for match in pattern.finditer(text):
            phrase = match.group(1).strip().lower()
            if phrase not in seen:
                seen.add(phrase)
                phrases.append(match.group(1))
    return phrases[:10]


def _generate_summary(text: str, score: float, pos_count: int, neg_count: int) -> str:
    total = pos_count + neg_count
    if total == 0:
        return "The text appears neutral with no strong sentiment indicators."

    pos_pct = pos_count / total * 100
    neg_pct = neg_count / total * 100

    if score > 0.65:
        sentiment_desc = "positive"
    elif score < 0.35:
        sentiment_desc = "negative"
    else:
        sentiment_desc = "mixed"

    return (
        f"The sentiment is predominantly {sentiment_desc} "
        f"({pos_pct:.0f}% positive, {neg_pct:.0f}% negative indicators "
        f"across {total} sentiment-bearing terms)."
    )


def analyze_sentiment(text: str, context: Optional[str] = None) -> dict:
    if not text.strip():
        return {
            "sentiment": "NEUTRAL",
            "score": 0.5,
            "emotions": {"satisfaction": 0.0, "frustration": 0.0, "engagement": 0.0, "confidence": 0.0},
            "key_phrases": [],
            "summary": "No text provided for analysis.",
        }

    score, pos, neg, sat, fru, eng, con = _score_lexicon(text)
    phrases = _extract_key_phrases(text)
    summary = _generate_summary(text, score, pos, neg)

    if score >= 0.65:
        sentiment = "POSITIVE"
    elif score <= 0.35:
        sentiment = "NEGATIVE"
    else:
        sentiment = "NEUTRAL"

    return {
        "sentiment": sentiment,
        "score": score,
        "emotions": {
            "satisfaction": sat,
            "frustration": fru,
            "engagement": eng,
            "confidence": con,
        },
        "key_phrases": phrases,
        "summary": summary,
    }


# ──────────────────────────────────────────────
#  Survey analysis
# ──────────────────────────────────────────────

_CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "culture": ["culture", "values", "mission", "belonging", "inclusive", "diverse", "colleagues", "team", "community"],
    "management": ["manager", "leadership", "supervisor", "management", "director", "vp", "executive", "senior leader"],
    "compensation": ["salary", "pay", "compensation", "bonus", "equity", "raise", "benefits", "stock", "package"],
    "work_life_balance": ["work-life", "balance", "hours", "flexible", "remote", "schedule", "overtime", "vacation", "pto"],
    "career_growth": ["career", "growth", "promotion", "development", "training", "learning", "advancement", "mentor"],
}


def analyze_survey(responses: list[dict]) -> dict:
    if not responses:
        return {
            "overall_sentiment": 0.5,
            "categories": {},
            "trend": "stable",
            "highlights": [],
            "concerns": [],
        }

    total_score = 0.0
    cat_scores: dict[str, list[float]] = {cat: [] for cat in _CATEGORY_KEYWORDS}
    highlights: list[str] = []
    concerns: list[str] = []

    for resp in responses:
        text = resp.get("answer_text", "")
        rating = resp.get("rating")

        if rating is not None:
            # Convert 1-5 rating to 0-1 score
            rating_score = (rating - 1) / 4.0
        else:
            rating_score = None

        # Sentiment analysis on answer text
        if text.strip():
            sent_result = analyze_sentiment(text)
            text_score = sent_result["score"]
        else:
            text_score = 0.5

        # Combine rating and text sentiment
        if rating_score is not None:
            combined = rating_score * 0.6 + text_score * 0.4
        else:
            combined = text_score

        total_score += combined
        lower_text = text.lower()

        # Categorise
        for cat, keywords in _CATEGORY_KEYWORDS.items():
            if any(kw in lower_text for kw in keywords):
                cat_scores[cat].append(combined)

        # Identify highlights and concerns
        if combined >= 0.75 and len(text) > 15:
            highlights.append(text[:100].rstrip(".!") + ".")
        elif combined <= 0.35 and len(text) > 15:
            concerns.append(text[:100].rstrip(".!") + ".")

    overall = total_score / max(len(responses), 1)
    categories = {}
    for cat, scores in cat_scores.items():
        if scores:
            categories[cat] = round(sum(scores) / len(scores), 2)

    # Trend (compare last 30% of responses to first 30%)
    n = len(responses)
    if n >= 6:
        split = n // 3
        first_third = sum(
            (responses[i].get("rating", 3) or 3) / 5.0
            for i in range(split)
        ) / split
        last_third = sum(
            (responses[i].get("rating", 3) or 3) / 5.0
            for i in range(n - split, n)
        ) / split
        if last_third - first_third > 0.05:
            trend = "improving"
        elif first_third - last_third > 0.05:
            trend = "declining"
        else:
            trend = "stable"
    else:
        trend = "stable"

    return {
        "overall_sentiment": round(overall, 2),
        "categories": categories,
        "trend": trend,
        "highlights": highlights[:5],
        "concerns": concerns[:5],
    }
