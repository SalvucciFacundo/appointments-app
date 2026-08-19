package middleware

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/salvuccifacundo/appointments-app/backend/internal/store"
)

// BootstrapResolver resolves the legacy owner actor the X-API-Key fallback
// maps to. *service.Service implements it.
type BootstrapResolver interface {
	BootstrapOwner(ctx context.Context) (store.Actor, error)
}

// RequireAuth protects routes behind authentication. A session actor resolved
// by the global Session middleware always passes. Without one, a valid
// X-API-Key maps to the bootstrap owner during the transition (unless
// disabled). Requests with neither get 401 unauthorized.
func RequireAuth(bootstrap BootstrapResolver, apiKey string, disableAPIKey bool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if ActorFromContext(r.Context()) != nil {
				next.ServeHTTP(w, r)
				return
			}
			if !disableAPIKey && apiKey != "" && SecureEqual(r.Header.Get("X-API-Key"), apiKey) {
				actor, err := bootstrap.BootstrapOwner(r.Context())
				if err != nil {
					slog.Error("bootstrap owner resolution failed", "error", err)
					writeError(w, http.StatusInternalServerError, "internal", "internal server error", "")
					return
				}
				slog.Warn("X-API-Key is deprecated; use cookie sessions", "path", r.URL.Path)
				ctx := withActor(r.Context(), &actor)
				ctx = withViaSession(ctx, false)
				next.ServeHTTP(w, r.WithContext(ctx))
				return
			}
			writeError(w, http.StatusUnauthorized, "unauthorized", "authentication required", "")
		})
	}
}
