package middleware

import (
	"log/slog"
	"net/http"
)

// Recover converts panics into 500 responses following the error contract
// instead of crashing the server. A nil logger falls back to slog.Default.
func Recover(logger *slog.Logger) func(http.Handler) http.Handler {
	if logger == nil {
		logger = slog.Default()
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if rec := recover(); rec != nil {
					logger.Error("panic recovered", "panic", rec, "path", r.URL.Path)
					writeError(w, http.StatusInternalServerError, "internal", "internal server error", "")
				}
			}()
			next.ServeHTTP(w, r)
		})
	}
}
