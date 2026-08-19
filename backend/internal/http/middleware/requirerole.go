package middleware

import (
	"net/http"

	"github.com/salvuccifacundo/appointments-app/backend/internal/store"
)

// RequireRole blocks requests whose authenticated actor lacks the given role.
// Anonymous requests and actors with a different role both get 403 forbidden.
func RequireRole(role store.Role) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			actor := ActorFromContext(r.Context())
			if actor == nil || actor.Role != role {
				writeError(w, http.StatusForbidden, "forbidden", "insufficient role", "")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
