FROM golang:1.20-alpine AS builder
WORKDIR /app
COPY go.mod ./
# COPY go.sum ./
RUN go mod download
COPY *.go ./
RUN go build -o notification-service

FROM alpine:latest
WORKDIR /root/
COPY --from=builder /app/notification-service .
EXPOSE 8004
CMD ["./notification-service"]
