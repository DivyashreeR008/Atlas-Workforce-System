FROM python:3.10-slim AS builder

WORKDIR /app

COPY services/atlas_observability/ ./services/atlas_observability/
RUN pip install -e ./services/atlas_observability
COPY services/audit-compliance-service/requirements.txt .
RUN grep -v "atlas_observability" requirements.txt > req_clean.txt && \
    pip install --no-cache-dir -r req_clean.txt

FROM python:3.10-slim AS runtime

WORKDIR /app

COPY --from=builder /usr/local/ /usr/local/
COPY --from=builder /app/services/atlas_observability /app/services/atlas_observability
RUN pip install --no-cache-dir -e ./services/atlas_observability

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY services/audit-compliance-service/ .

EXPOSE 8011

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8011"]
