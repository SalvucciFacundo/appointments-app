package middleware

import (
	"context"
	"net/http"

	"github.com/salvuccifacundo/appointments-app/backend/internal/config"
	"github.com/salvuccifacundo/appointments-app/backend/internal/store"
)

// SessionResolver resolves the authenticated actor and its session-bound CSRF
// token from a raw session token. *service.Service implements it.
type SessionResolver interface {
	AuthenticateSession(ctx context.Context, rawToken string) (store.Actor, error)
	SessionCSRFToken(ctx context.Context, rawToken string) (string, error)
}

// ctxKey is the private type for context keys to avoid collisions.
type ctxKey int

const (
	actorKey ctxKey = iota
	csrfKey
	sessionKey
)

// withActor stores the authenticated actor in the request context.
func withActor(ctx context.Context, actor *store.Actor) context.Context {
	return context.WithValue(ctx, actorKey, actor)
}

// ActorFromContext returns the authenticated actor from the request context,
// or nil when the request is anonymous.
func ActorFromContext(ctx context.Context) *store.Actor {
	actor, _ := ctx.Value(actorKey).(*store.Actor)
	return actor
}

// withCSRF stores the session-bound CSRF token in the request context.
func withCSRF(ctx context.Context, token string) context.Context {
	return context.WithValue(ctx, csrfKey, token)
}

// csrfFromContext returns the CSRF token bound to the current session.
func csrfFromContext(ctx context.Context) string {
	token, _ := ctx.Value(csrfKey).(string)
	return token
}

// withViaSession records whether the actor was resolved from a cookie session
// (true) or the legacy X-API-Key fallback (false).
func withViaSession(ctx context.Context, via bool) context.Context {
	return context.WithValue(ctx, sessionKey, via)
}

// viaSession reports whether the authenticated actor came from a cookie
// session. Anonymous requests report false.
func viaSession(ctx context.Context) bool {
	via, _ := ctx.Value(sessionKey).(bool)
	return via
}

// Session resolves the authenticated actor from the session cookie on every
// request and stores it (with its CSRF token) in the context. It never blocks
// anonymous requests: routes decide whether authentication is required.
func Session(resolver SessionResolver) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			raw := ""
			if c, err := r.Cookie(config.SessionCookie); err == nil {
				raw = c.Value
			}
			if raw != "" {
				if actor, err := resolver.AuthenticateSession(r.Context(), raw); err == nil {
					if token, err := resolver.SessionCSRFToken(r.Context(), raw); err == nil {
						ctx := withActor(r.Context(), &actor)
						ctx = withCSRF(ctx, token)
						ctx = withViaSession(ctx, true)
						next.ServeHTTP(w, r.WithContext(ctx))
						return
					}
				}
			}
			next.ServeHTTP(w, r)
		})
	}
}
