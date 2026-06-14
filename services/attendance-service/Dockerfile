FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go mod tidy && CGO_ENABLED=0 GOOS=linux go build -o attendance-service

FROM alpine:latest
WORKDIR /root/
COPY --from=builder /app/attendance-service .
EXPOSE 8005
CMD ["./attendance-service"]
