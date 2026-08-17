package middleware

import "net/http"

// CORS allows browser cross-origin requests from the configured origins. It
// answers preflight OPTIONS requests with 204 and sets CORS headers only for
// matching origins. A "*" entry disables cross-origin access: with
// credentials:include the Allow-Origin header must be an explicit origin, so
// the header is omitted and the browser denies the request.
func CORS(origins []string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			if origin != "" && isAllowedOrigin(origin, origins) && !hasWildcardOrigin(origins) {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Add("Vary", "Origin")
				w.Header().Set("Access-Control-Allow-Credentials", "true")
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
				w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-API-Key, X-CSRF-Token")
			}
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// hasWildcardOrigin reports whether the allowed list contains a "*" entry.
func hasWildcardOrigin(origins []string) bool {
	for _, o := range origins {
		if o == "*" {
			return true
		}
	}
	return false
}

// isAllowedOrigin reports whether origin matches the allowed list.
func isAllowedOrigin(origin string, origins []string) bool {
	for _, o := range origins {
		if o == "*" || o == origin {
			return true
		}
	}
	return false
}
