# syntax=docker/dockerfile:1

# --- Build stage ---
FROM golang:1.26-alpine AS build
WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /app/api ./cmd/api

# --- Runtime stage ---
# distroless static: no shell, no glibc deps; tzdata is embedded in the binary
# via the blank `_ "time/tzdata"` import so time.LoadLocation works here.
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /app/api /api
EXPOSE 8080
CMD ["/api"]
