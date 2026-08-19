// Package config loads the backend runtime configuration from environment
// variables with sensible defaults for local development.
package config

import (
	"os"
	"strconv"
	"strings"
	"time"
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
	// OwnerID is the fixed owner id for the single-owner dashboard (auth
	// stub). The bootstrap owner user reuses this id so existing stores keep
	// their ownership.
	OwnerID string
	// CORSOrigins is the list of allowed browser origins.
	CORSOrigins []string
	// APPURL is the public base URL of the SPA frontend.
	APPURL string
	// SessionTTL is how long a login session stays valid.
	SessionTTL time.Duration
	// CookieSecure sets the Secure flag on the session/CSRF cookies. It
	// defaults to true for production; local dev over http must set
	// COOKIE_SECURE=false.
	CookieSecure bool
	// OwnerBootstrapEmail is the email that registers with role OWNER
	// (bootstrap). All other registrations get role USER.
	OwnerBootstrapEmail string
	// AuthDisableAPIKey disables the X-API-Key fallback once the UI is fully
	// migrated to cookie sessions.
	AuthDisableAPIKey bool
	// Argon2Memory is the Argon2id memory cost (KiB) used to hash passwords.
	Argon2Memory uint32
	// Argon2Time is the Argon2id iteration count.
	Argon2Time uint32
}

// Cookie names for the session and CSRF double-submit values.
const (
	SessionCookie = "session"
	CsrfCookie    = "csrf_token"
)

const (
	defaultDatabaseURL    = "postgres://postgres:postgres@localhost:5432/appointments?sslmode=disable"
	defaultPort           = "8080"
	defaultOwnerID        = "dashboard-owner"
	defaultCORSOrigins    = "http://localhost:5173"
	defaultAPPURL         = "http://localhost:5173"
	defaultSessionTTL     = "24h"
	defaultBootstrapEmail = "dashboard-owner@localhost"
	defaultArgon2Memory   = 65536
	defaultArgon2Time     = 1
)

// Load reads configuration from the environment, falling back to local dev defaults.
func Load() *Config {
	return &Config{
		DatabaseURL:         getenv("DATABASE_URL", defaultDatabaseURL),
		Port:                getenv("PORT", defaultPort),
		APIKey:              os.Getenv("API_KEY"),
		OwnerID:             getenv("OWNER_ID", defaultOwnerID),
		CORSOrigins:         splitCSV(getenv("CORS_ORIGINS", defaultCORSOrigins)),
		APPURL:              getenv("APP_URL", defaultAPPURL),
		SessionTTL:          getDuration("SESSION_TTL", defaultSessionTTL),
		CookieSecure:        getBool("COOKIE_SECURE", true),
		OwnerBootstrapEmail: getenv("OWNER_BOOTSTRAP_EMAIL", defaultBootstrapEmail),
		AuthDisableAPIKey:   getBool("AUTH_DISABLE_API_KEY", false),
		Argon2Memory:        getUint32("ARGON2_MEMORY", defaultArgon2Memory),
		Argon2Time:          getUint32("ARGON2_TIME", defaultArgon2Time),
	}
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getBool(key string, fallback bool) bool {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		return fallback
	}
	return b
}

func getDuration(key, fallback string) time.Duration {
	v := getenv(key, fallback)
	d, err := time.ParseDuration(v)
	if err != nil {
		d, _ = time.ParseDuration(fallback)
	}
	return d
}

func getUint32(key string, fallback uint32) uint32 {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	n, err := strconv.ParseUint(v, 10, 32)
	if err != nil {
		return fallback
	}
	return uint32(n)
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
