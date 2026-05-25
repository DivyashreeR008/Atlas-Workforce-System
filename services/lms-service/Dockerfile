FROM golang:1.21-alpine AS builder

RUN apk add --no-cache git

WORKDIR /app

COPY go.mod go.sum* ./
RUN go mod download 2>/dev/null || true

COPY . .

RUN go mod tidy && CGO_ENABLED=0 GOOS=linux go build -o /app/lms-service .

FROM alpine:3.19

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

COPY --from=builder /app/lms-service .

EXPOSE 8013

CMD ["./lms-service"]
