# Stage 1: Build dependencies
FROM python:3.10-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends gcc g++ libpq-dev && rm -rf /var/lib/apt/lists/*
COPY services/analytics-python-service/requirements.txt .
RUN pip install --user --no-cache-dir --ignore-installed typing_extensions>=4.8.0 && \
    grep -v "atlas_observability" requirements.txt > req_clean.txt && \
    pip install --user --no-cache-dir --ignore-installed -r req_clean.txt
COPY services/atlas_observability/ ./services/atlas_observability/
RUN pip install --user --no-cache-dir --no-deps -e ./services/atlas_observability && \
    pip install --user --no-cache-dir prometheus-client>=0.19.0

# Stage 2: Final minimal runner
FROM python:3.10-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libpq5 && rm -rf /var/lib/apt/lists/*
COPY --from=builder /root/.local /root/.local
COPY --from=builder /app/services/atlas_observability /app/services/atlas_observability
RUN pip install --user --no-cache-dir --ignore-installed --no-deps -e ./services/atlas_observability
COPY services/analytics-python-service/ .
ENV PATH=/root/.local/bin:$PATH
EXPOSE 8003
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8003"]
