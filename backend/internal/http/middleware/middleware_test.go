package middleware

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/salvuccifacundo/appointments-app/backend/internal/config"
	"github.com/salvuccifacundo/appointments-app/backend/internal/store"
)

func TestMain(m *testing.M) {
	slog.SetDefault(slog.New(slog.NewTextHandler(io.Discard, nil)))
	os.Exit(m.Run())
}

// okHandler returns a handler that always responds 200.
func okHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
}

// newRequest builds a GET request with a fixed remote address.
func newRequest(remote string) *http.Request {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.RemoteAddr = remote
	return req
}

// decodeErrorBody parses the error contract from a response body.
func decodeErrorBody(t *testing.T, r *httptest.ResponseRecorder) (int, string, string) {
	t.Helper()
	var body struct {
		Error struct {
			Code    string `json:"code"`
			Message string `json:"message"`
			Field   string `json:"field"`
		} `json:"error"`
	}
	if err := json.Unmarshal(r.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode error body: %v (body=%q)", err, r.Body.String())
	}
	return r.Code, body.Error.Code, body.Error.Field
}

func TestRateLimit_Anonymous429WithRetryAfter(t *testing.T) {
	h := RateLimit(IsOwner("secret-key"))(okHandler())

	for i := 0; i < AnonymousRateLimit; i++ {
		rr := httptest.NewRecorder()
		h.ServeHTTP(rr, newRequest("203.0.113.5:1234"))
		if rr.Code != http.StatusOK {
			t.Fatalf("request %d: status %d, want 200", i+1, rr.Code)
		}
	}

	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, newRequest("203.0.113.5:1234"))
	if rr.Code != http.StatusTooManyRequests {
		t.Fatalf("11th request: status %d, want 429", rr.Code)
	}
	if got := rr.Header().Get("Retry-After"); got == "" {
		t.Error("429 response missing Retry-After header")
	}
	status, code, _ := decodeErrorBody(t, rr)
	if status != http.StatusTooManyRequests || code != "rate_limited" {
		t.Errorf("error contract = (%d, %q), want (429, rate_limited)", status, code)
	}
}

func TestRateLimit_DifferentClientsNotCounted(t *testing.T) {
	h := RateLimit(IsOwner("secret-key"))(okHandler())
	// Exhaust one client; a different IP must still pass.
	for i := 0; i <= AnonymousRateLimit; i++ {
		rr := httptest.NewRecorder()
		h.ServeHTTP(rr, newRequest("203.0.113.5:1234"))
		_ = rr
	}
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, newRequest("198.51.100.9:5555"))
	if rr.Code != http.StatusOK {
		t.Fatalf("fresh client status %d, want 200", rr.Code)
	}
}

func TestRateLimit_OwnerGetsHigherLimit(t *testing.T) {
	h := RateLimit(IsOwner("secret-key"))(okHandler())

	req := func() *httptest.ResponseRecorder {
		rr := httptest.NewRecorder()
		r := newRequest("203.0.113.5:1234")
		r.Header.Set("X-API-Key", "secret-key")
		h.ServeHTTP(rr, r)
		return rr
	}

	for i := 0; i < OwnerRateLimit; i++ {
		if rr := req(); rr.Code != http.StatusOK {
			t.Fatalf("owner request %d: status %d, want 200", i+1, rr.Code)
		}
	}
	if rr := req(); rr.Code != http.StatusTooManyRequests {
		t.Fatalf("31st owner request: status %d, want 429", rr.Code)
	}
}

func TestRateLimit_OwnerTierBySessionActor(t *testing.T) {
	ownerActor := store.Actor{ID: "owner-1", Name: "Owner", Email: "owner@example.com", Role: store.RoleOwner}
	h := RateLimit(func(r *http.Request) bool {
		a := ActorFromContext(r.Context())
		return a != nil && a.Role == store.RoleOwner
	})(okHandler())

	ownerReq := func() *httptest.ResponseRecorder {
		rr := httptest.NewRecorder()
		r := newRequest("203.0.113.5:1234")
		r = r.WithContext(withActor(r.Context(), &ownerActor))
		h.ServeHTTP(rr, r)
		return rr
	}

	for i := 0; i < OwnerRateLimit; i++ {
		if rr := ownerReq(); rr.Code != http.StatusOK {
			t.Fatalf("owner request %d: status %d, want 200", i+1, rr.Code)
		}
	}
	if rr := ownerReq(); rr.Code != http.StatusTooManyRequests {
		t.Fatalf("31st owner request: status %d, want 429", rr.Code)
	}
}

// fakeSessionResolver resolves a fixed actor/CSRF pair or fails as configured.
type fakeSessionResolver struct {
	actor   store.Actor
	token   string
	sessErr error
	csrfErr error
}

func (f fakeSessionResolver) AuthenticateSession(_ context.Context, raw string) (store.Actor, error) {
	if f.sessErr != nil {
		return store.Actor{}, f.sessErr
	}
	return f.actor, nil
}

func (f fakeSessionResolver) SessionCSRFToken(_ context.Context, raw string) (string, error) {
	if f.csrfErr != nil {
		return "", f.csrfErr
	}
	return f.token, nil
}

// captureActor records the actor, CSRF token, and viaSession flag a handler
// observes, so Session tests can assert the injected context.
func captureActor(t *testing.T, r *http.Request) (*store.Actor, string, bool) {
	t.Helper()
	return ActorFromContext(r.Context()), csrfFromContext(r.Context()), viaSession(r.Context())
}

func TestSession_AnonymousRequestWithoutCookie(t *testing.T) {
	var gotActor *store.Actor
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotActor, _, _ = captureActor(t, r)
		w.WriteHeader(http.StatusOK)
	})
	h := Session(fakeSessionResolver{actor: store.Actor{ID: "u1", Role: store.RoleUser}, token: "csrf"})(inner)

	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, newRequest("203.0.113.5:1234"))
	if rr.Code != http.StatusOK {
		t.Fatalf("status %d, want 200 (anonymous must not be blocked)", rr.Code)
	}
	if gotActor != nil {
		t.Errorf("actor = %+v, want nil for anonymous request", gotActor)
	}
}

func TestSession_InjectsActorCSRFAndViaSession(t *testing.T) {
	var gotActor *store.Actor
	var gotCSRF string
	var gotVia bool
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotActor, gotCSRF, gotVia = captureActor(t, r)
		w.WriteHeader(http.StatusOK)
	})
	actor := store.Actor{ID: "u1", Name: "Ana", Email: "ana@example.com", Role: store.RoleUser}
	h := Session(fakeSessionResolver{actor: actor, token: "csrf-token"})(inner)

	r := newRequest("203.0.113.5:1234")
	r.AddCookie(&http.Cookie{Name: config.SessionCookie, Value: "raw-token"})
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, r)
	if rr.Code != http.StatusOK {
		t.Fatalf("status %d, want 200", rr.Code)
	}
	if gotActor == nil || gotActor.ID != "u1" {
		t.Errorf("actor = %+v, want u1", gotActor)
	}
	if gotCSRF != "csrf-token" {
		t.Errorf("csrf = %q, want csrf-token", gotCSRF)
	}
	if !gotVia {
		t.Error("viaSession = false, want true for a cookie session")
	}
}

func TestSession_InvalidSessionStaysAnonymous(t *testing.T) {
	var gotActor *store.Actor
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotActor, _, _ = captureActor(t, r)
		w.WriteHeader(http.StatusOK)
	})
	h := Session(fakeSessionResolver{sessErr: errors.New("expired")})(inner)

	r := newRequest("203.0.113.5:1234")
	r.AddCookie(&http.Cookie{Name: config.SessionCookie, Value: "expired-token"})
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, r)
	if gotActor != nil {
		t.Errorf("actor = %+v, want nil when the session is invalid", gotActor)
	}
}

func TestSession_CSRFLookupFailureStaysAnonymous(t *testing.T) {
	var gotActor *store.Actor
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotActor, _, _ = captureActor(t, r)
		w.WriteHeader(http.StatusOK)
	})
	h := Session(fakeSessionResolver{actor: store.Actor{ID: "u1"}, csrfErr: errors.New("gone")})(inner)

	r := newRequest("203.0.113.5:1234")
	r.AddCookie(&http.Cookie{Name: config.SessionCookie, Value: "raw-token"})
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, r)
	if gotActor != nil {
		t.Errorf("actor = %+v, want nil when the CSRF lookup fails", gotActor)
	}
}

// fakeBootstrap resolves a fixed bootstrap actor for RequireAuth tests.
type fakeBootstrap struct {
	actor store.Actor
	err   error
}

func (f fakeBootstrap) BootstrapOwner(_ context.Context) (store.Actor, error) {
	return f.actor, f.err
}

func TestRequireAuth_401WithoutCredentials(t *testing.T) {
	h := RequireAuth(fakeBootstrap{}, "secret-key", false)(okHandler())
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, newRequest("203.0.113.5:1234"))
	status, code, _ := decodeErrorBody(t, rr)
	if status != http.StatusUnauthorized || code != "unauthorized" {
		t.Errorf("error contract = (%d, %q), want (401, unauthorized)", status, code)
	}
}

func TestRequireAuth_401WithWrongKey(t *testing.T) {
	h := RequireAuth(fakeBootstrap{}, "secret-key", false)(okHandler())
	rr := httptest.NewRecorder()
	r := newRequest("203.0.113.5:1234")
	r.Header.Set("X-API-Key", "wrong-key")
	h.ServeHTTP(rr, r)
	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("status %d, want 401", rr.Code)
	}
}

func TestRequireAuth_ValidKeyMapsToBootstrapActor(t *testing.T) {
	bootstrap := store.Actor{ID: "dashboard-owner", Name: "Dashboard Owner", Email: "owner@example.com", Role: store.RoleOwner}
	var got *store.Actor
	var gotVia bool
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got = ActorFromContext(r.Context())
		gotVia = viaSession(r.Context())
		w.WriteHeader(http.StatusOK)
	})
	h := RequireAuth(fakeBootstrap{actor: bootstrap}, "secret-key", false)(inner)

	rr := httptest.NewRecorder()
	r := newRequest("203.0.113.5:1234")
	r.Header.Set("X-API-Key", "secret-key")
	h.ServeHTTP(rr, r)
	if rr.Code != http.StatusOK {
		t.Fatalf("status %d, want 200", rr.Code)
	}
	if got == nil || got.ID != "dashboard-owner" {
		t.Errorf("actor = %+v, want bootstrap actor", got)
	}
	if gotVia {
		t.Error("viaSession = true, want false for the API-key fallback")
	}
}

func TestRequireAuth_SessionActorTakesPriority(t *testing.T) {
	// An authenticated actor passes even with a wrong API key.
	actor := store.Actor{ID: "u1", Role: store.RoleOwner}
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	h := RequireAuth(fakeBootstrap{}, "secret-key", false)(inner)

	r := newRequest("203.0.113.5:1234")
	r = r.WithContext(withActor(r.Context(), &actor))
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, r)
	if rr.Code != http.StatusOK {
		t.Fatalf("status %d, want 200 (session actor must win over the API key)", rr.Code)
	}
}

func TestRequireAuth_DisabledAPIKeyReturns401(t *testing.T) {
	h := RequireAuth(fakeBootstrap{}, "secret-key", true)(okHandler())
	rr := httptest.NewRecorder()
	r := newRequest("203.0.113.5:1234")
	r.Header.Set("X-API-Key", "secret-key")
	h.ServeHTTP(rr, r)
	status, code, _ := decodeErrorBody(t, rr)
	if status != http.StatusUnauthorized || code != "unauthorized" {
		t.Errorf("error contract = (%d, %q), want (401, unauthorized)", status, code)
	}
}

func TestRequireRole_AllowsMatchingRole(t *testing.T) {
	actor := store.Actor{ID: "u1", Role: store.RoleOwner}
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	h := RequireRole(store.RoleOwner)(inner)

	r := newRequest("203.0.113.5:1234")
	r = r.WithContext(withActor(r.Context(), &actor))
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, r)
	if rr.Code != http.StatusOK {
		t.Fatalf("status %d, want 200", rr.Code)
	}
}

func TestRequireRole_ForbidsDifferentRole(t *testing.T) {
	actor := store.Actor{ID: "u1", Role: store.RoleUser}
	h := RequireRole(store.RoleOwner)(okHandler())

	r := newRequest("203.0.113.5:1234")
	r = r.WithContext(withActor(r.Context(), &actor))
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, r)
	status, code, _ := decodeErrorBody(t, rr)
	if status != http.StatusForbidden || code != "forbidden" {
		t.Errorf("error contract = (%d, %q), want (403, forbidden)", status, code)
	}
}

func TestRequireRole_ForbidsAnonymous(t *testing.T) {
	h := RequireRole(store.RoleOwner)(okHandler())
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, newRequest("203.0.113.5:1234"))
	status, code, _ := decodeErrorBody(t, rr)
	if status != http.StatusForbidden || code != "forbidden" {
		t.Errorf("error contract = (%d, %q), want (403, forbidden)", status, code)
	}
}

// csrfRequest builds a request with the given method and session context.
func csrfRequest(method string, via bool, csrf string) *http.Request {
	r := newRequest("203.0.113.5:1234")
	r.Method = method
	ctx := withViaSession(r.Context(), via)
	ctx = withCSRF(ctx, csrf)
	return r.WithContext(ctx)
}

func TestCSRF_SessionMutationWithoutTokenForbidden(t *testing.T) {
	h := CSRF()(okHandler())
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, csrfRequest(http.MethodPost, true, "csrf-token"))
	status, code, _ := decodeErrorBody(t, rr)
	if status != http.StatusForbidden || code != "csrf_invalid" {
		t.Errorf("error contract = (%d, %q), want (403, csrf_invalid)", status, code)
	}
}

func TestCSRF_SessionMutationWithWrongTokenForbidden(t *testing.T) {
	h := CSRF()(okHandler())
	r := csrfRequest(http.MethodPost, true, "csrf-token")
	r.Header.Set("X-CSRF-Token", "wrong-token")
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, r)
	status, code, _ := decodeErrorBody(t, rr)
	if status != http.StatusForbidden || code != "csrf_invalid" {
		t.Errorf("error contract = (%d, %q), want (403, csrf_invalid)", status, code)
	}
}

func TestCSRF_SessionMutationWithValidTokenPasses(t *testing.T) {
	h := CSRF()(okHandler())
	r := csrfRequest(http.MethodPost, true, "csrf-token")
	r.Header.Set("X-CSRF-Token", "csrf-token")
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, r)
	if rr.Code != http.StatusOK {
		t.Fatalf("status %d, want 200", rr.Code)
	}
}

func TestCSRF_AnonymousMutationBypassed(t *testing.T) {
	// No session (viaSession=false): the legacy API-key path and public
	// endpoints are exempt from CSRF.
	h := CSRF()(okHandler())
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, csrfRequest(http.MethodPost, false, ""))
	if rr.Code != http.StatusOK {
		t.Fatalf("status %d, want 200", rr.Code)
	}
}

func TestCSRF_GETNotEnforced(t *testing.T) {
	h := CSRF()(okHandler())
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, csrfRequest(http.MethodGet, true, ""))
	if rr.Code != http.StatusOK {
		t.Fatalf("status %d, want 200 (GET is not a mutation)", rr.Code)
	}
}
