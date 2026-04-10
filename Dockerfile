# Build stage
FROM golang:1.24-alpine AS builder

# Install dependencies
RUN apk add --no-cache git ca-certificates tzdata

WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags="-w -s -X main.Version=docker -X main.BuildDate=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    -o /app/bin/server ./cmd/server

# Runtime stage
FROM alpine:latest

# Install ca-certificates for HTTPS requests
RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/bin/server /app/server

# Copy necessary files
COPY --from=builder /app/config.example.yaml /app/config.example.yaml
COPY --from=builder /app/model_settings.json /app/model_settings.json

# Create directories
RUN mkdir -p /app/logs /app/auths /app/assets /app/static

# Expose port
EXPOSE 9999

# Run the application
CMD ["/app/server"]
