# Appointments backend — development targets.

.PHONY: run build test vet lint tools migrate-up migrate-down

DATABASE_URL ?= postgres://postgres:postgres@localhost:5432/appointments?sslmode=disable
MIGRATION_DIR ?= migrations
GOOSE_VERSION ?= v3.27.3

run: ## Run the API locally
	go run ./cmd/api

build: ## Compile all packages (does not write binaries)
	go build ./...

test: ## Run all tests
	go test ./...

vet: ## Run go vet
	go vet ./...

lint: ## Run golangci-lint (requires golangci-lint on PATH)
	golangci-lint run

tools: ## Install dev tools (goose migration CLI)
	go install github.com/pressly/goose/v3/cmd/goose@$(GOOSE_VERSION)

migrate-up: ## Apply pending goose migrations (requires `make tools` once)
	goose -dir $(MIGRATION_DIR) postgres "$(DATABASE_URL)" up

migrate-down: ## Roll back the last goose migration
	goose -dir $(MIGRATION_DIR) postgres "$(DATABASE_URL)" down
