package middleware

import (
	"math"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/salvuccifacundo/appointments-app/backend/internal/store"
)

// Rate limit configuration: owner clients (valid X-API-Key) get a higher
// per-minute allowance than anonymous clients, per the design spec.
const (
	AnonymousRateLimit = 10
	OwnerRateLimit     = 30
	rateLimitWindow    = time.Minute
)

// windowEntry tracks the request count within the current window.
type windowEntry struct {
	count   int
	resetAt time.Time
}

// limiter is an in-memory sliding-window limiter keyed by client. It is
// suitable for single-instance deployments; it is not shared across
// processes.
type limiter struct {
	mu      sync.Mutex
	entries map[string]*windowEntry
}

// allow records a request for key and reports whether it fits within limit
// requests for the current window, returning the window reset time.
func (l *limiter) allow(key string, limit int) (bool, time.Time) {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()
	entry, ok := l.entries[key]
	if !ok || !now.Before(entry.resetAt) {
		l.entries[key] = &windowEntry{count: 1, resetAt: now.Add(rateLimitWindow)}
		return true, now.Add(rateLimitWindow)
	}

	entry.count++
	if entry.count > limit {
		return false, entry.resetAt
	}
	return true, entry.resetAt
}

// RateLimit limits requests per client: requests the isOwner predicate
// classifies as owner-tier get OwnerRateLimit per minute, everyone else
// AnonymousRateLimit. Exceeding the limit yields 429 with a Retry-After
// header. A nil predicate never classifies a request as owner-tier.
func RateLimit(isOwner func(*http.Request) bool) func(http.Handler) http.Handler {
	l := &limiter{entries: make(map[string]*windowEntry)}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			key, limit := clientID(r), AnonymousRateLimit
			if isOwner != nil && isOwner(r) {
				key, limit = "owner:"+key, OwnerRateLimit
			}

			allowed, resetAt := l.allow(key, limit)
			if !allowed {
				retryAfter := int(math.Ceil(time.Until(resetAt).Seconds()))
				if retryAfter < 1 {
					retryAfter = 1
				}
				w.Header().Set("Retry-After", strconv.Itoa(retryAfter))
				writeError(w, http.StatusTooManyRequests, "rate_limited", "rate limit exceeded, try again later", "")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// IsOwner returns a rate-limit tier predicate: owner-tier for a session
// authenticated OWNER actor or a valid X-API-Key during the transition.
func IsOwner(apiKey string) func(*http.Request) bool {
	return func(r *http.Request) bool {
		if actor := ActorFromContext(r.Context()); actor != nil && actor.Role == store.RoleOwner {
			return true
		}
		return apiKey != "" && SecureEqual(r.Header.Get("X-API-Key"), apiKey)
	}
}

// clientID derives the rate-limit key from the first X-Forwarded-For hop or
// the remote address, mirroring the TypeScript getClientId helper.
func clientID(r *http.Request) string {
	if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
		return "ip:" + strings.TrimSpace(strings.Split(fwd, ",")[0])
	}
	ip, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		ip = r.RemoteAddr
	}
	return "ip:" + ip
}
