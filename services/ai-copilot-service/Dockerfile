# ── Builder stage ──────────────────────────────
FROM python:3.10-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc build-essential && \
    rm -rf /var/lib/apt/lists/*

COPY services/atlas_observability/ ./services/atlas_observability/
RUN pip install -e ./services/atlas_observability
COPY requirements.txt .
RUN grep -v "atlas_observability" requirements.txt > req_clean.txt && \
    pip wheel --no-cache-dir --no-deps --wheel-dir /app/wheels -r req_clean.txt

# ── Runtime stage ─────────────────────────────
FROM python:3.10-slim AS runtime

WORKDIR /app

# Create non-root user
RUN addgroup --system app && adduser --system --ingroup app app

# Copy Python wheels from builder
COPY --from=builder /app/wheels /wheels
COPY --from=builder /app/requirements.txt .
RUN pip install --no-cache-dir /wheels/*

# Copy application code
COPY . .

# Switch to non-root user
USER app

EXPOSE 8015

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8015"]
