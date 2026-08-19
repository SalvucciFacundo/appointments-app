package middleware

import (
	"crypto/subtle"
	"net/http"
)

// CSRF validates the double-submit CSRF token on state-changing requests that
// are authenticated by a cookie session. The header X-CSRF-Token must match
// the session-bound token stored in the context (constant-time comparison).
// Mutations authenticated via the legacy X-API-Key fallback and anonymous
// requests are exempt. A missing or invalid token yields 403 csrf_invalid.
func CSRF() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if isMutation(r.Method) && viaSession(r.Context()) {
				want := csrfFromContext(r.Context())
				got := r.Header.Get("X-CSRF-Token")
				if want == "" || subtle.ConstantTimeCompare([]byte(want), []byte(got)) != 1 {
					writeError(w, http.StatusForbidden, "csrf_invalid", "missing or invalid CSRF token", "")
					return
				}
			}
			next.ServeHTTP(w, r)
		})
	}
}

// isMutation reports whether the method changes server state.
func isMutation(method string) bool {
	switch method {
	case http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete:
		return true
	}
	return false
}
