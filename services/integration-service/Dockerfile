FROM python:3.10-alpine AS builder
WORKDIR /app
RUN apk add --no-cache gcc musl-dev libffi-dev postgresql-dev librdkafka-dev
COPY services/integration-service/requirements.txt .
RUN pip install --user --no-cache-dir --ignore-installed typing_extensions>=4.8.0 && \
    grep -v "atlas_observability" requirements.txt > req_clean.txt && \
    pip install --user --no-cache-dir --ignore-installed -r req_clean.txt
COPY services/atlas_observability/ ./services/atlas_observability/
RUN pip install --user --no-cache-dir --no-deps -e ./services/atlas_observability && \
    pip install --user --no-cache-dir prometheus-client>=0.19.0

FROM python:3.10-alpine
WORKDIR /app
COPY --from=builder /root/.local /root/.local
COPY --from=builder /app/services/atlas_observability /app/services/atlas_observability
RUN pip install --user --no-cache-dir --ignore-installed --no-deps -e ./services/atlas_observability
COPY services/integration-service/ .
ENV PATH=/root/.local/bin:$PATH
EXPOSE 8016
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8016"]
