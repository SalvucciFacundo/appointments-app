// Package config loads the backend runtime configuration from environment
// variables with sensible defaults for local development.
package config

import (
	"os"
	"strings"
)

// Config holds the runtime configuration for the API.
type Config struct {
	// DatabaseURL is the PostgreSQL connection string (pgx format).
	DatabaseURL string
	// Port is the TCP port the HTTP server listens on.
	Port string
	// APIKey is the static dashboard API key (auth stub).
	// Empty means owner routes are not protected — set it in production.
	APIKey string
	// CORSOrigins is the list of allowed browser origins.
	CORSOrigins []string
	// APPURL is the public base URL of the SPA frontend.
	APPURL string
}

const (
	defaultDatabaseURL = "postgres://postgres:postgres@localhost:5432/appointments?sslmode=disable"
	defaultPort        = "8080"
	defaultCORSOrigins = "http://localhost:5173"
	defaultAPPURL      = "http://localhost:5173"
)

// Load reads configuration from the environment, falling back to local dev defaults.
func Load() *Config {
	return &Config{
		DatabaseURL: getenv("DATABASE_URL", defaultDatabaseURL),
		Port:        getenv("PORT", defaultPort),
		APIKey:      os.Getenv("API_KEY"),
		CORSOrigins: splitCSV(getenv("CORS_ORIGINS", defaultCORSOrigins)),
		APPURL:      getenv("APP_URL", defaultAPPURL),
	}
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func splitCSV(s string) []string {
	var out []string
	for _, part := range strings.Split(s, ",") {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}
