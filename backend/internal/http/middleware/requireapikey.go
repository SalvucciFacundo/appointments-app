package middleware

import (
	"crypto/subtle"
	"net/http"
)

// RequireAPIKey protects owner routes behind the static dashboard API key.
// Requests without a matching X-API-Key header get 401 with error code
// "unauthorized". An empty apiKey disables the check (local development).
func RequireAPIKey(apiKey string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if apiKey == "" || secureEqual(r.Header.Get("X-API-Key"), apiKey) {
				next.ServeHTTP(w, r)
				return
			}
			writeError(w, http.StatusUnauthorized, "unauthorized", "invalid or missing API key", "")
		})
	}
}

// secureEqual compares two strings in constant time to avoid timing attacks.
func secureEqual(a, b string) bool {
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}
