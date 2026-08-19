package handlers_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/salvuccifacundo/appointments-app/backend/internal/config"
	"github.com/salvuccifacundo/appointments-app/backend/internal/service"
	"github.com/salvuccifacundo/appointments-app/backend/internal/store"
)

// ownerActor is the bootstrap owner the API key maps to in tests.
var ownerActor = store.Actor{ID: "owner-1", Name: "Dashboard Owner", Email: "owner@example.com", Role: store.RoleOwner}

// userActor is a plain authenticated user (role USER).
var userActor = store.Actor{ID: "u-user", Name: "User", Email: "user@example.com", Role: store.RoleUser}

// sessionExpiry is a fixed future expiry for login fake results.
var sessionExpiry = time.Now().Add(time.Hour)

func TestDualTransition_OwnerRouteWithAPIKeyOnly(t *testing.T) {
	// No session cookie; only the X-API-Key header. The router maps it to the
	// bootstrap owner and proceeds (AUTH_DISABLE_API_KEY=false default).
	f := &fakeService{}
	f.listStoresByOwner = func(_ context.Context, actorID string) ([]store.StoreDetail, error) {
		if actorID != "owner-1" {
			t.Errorf("actorID = %q, want owner-1 (bootstrap)", actorID)
		}
		return []store.StoreDetail{}, nil
	}
	h := newTestRouter(t, f)
	rr := doRequest(t, h, http.MethodGet, "/api/stores", "")
	if rr.Code != http.StatusOK {
		t.Fatalf("status %d, want 200", rr.Code)
	}
}

func TestDualTransition_SessionTakesPriorityOverAPIKey(t *testing.T) {
	// A session-authenticated USER must NOT be promoted by the X-API-Key: the
	// session wins, so the owner route rejects the USER with 403.
	f := &fakeService{}
	rr := sessionRequest(t, f, userActor, "", http.MethodGet, "/api/stores")
	status, code, _, _ := errContract(t, rr)
	if status != http.StatusForbidden || code != "forbidden" {
		t.Errorf("got (%d, %q), want (403, forbidden)", status, code)
	}
}

func TestDualTransition_OwnerSessionOnOwnerRoute(t *testing.T) {
	// A session-authenticated OWNER reaches the owner routes without the API
	// key and without CSRF on GET.
	f := &fakeService{}
	f.listStoresByOwner = func(_ context.Context, actorID string) ([]store.StoreDetail, error) {
		if actorID != ownerActor.ID {
			t.Errorf("actorID = %q, want %q", actorID, ownerActor.ID)
		}
		return []store.StoreDetail{}, nil
	}
	rr := sessionRequest(t, f, ownerActor, "", http.MethodGet, "/api/stores")
	if rr.Code != http.StatusOK {
		t.Fatalf("status %d, want 200", rr.Code)
	}
}

func TestOwnerMutation_WithoutCSRFTokenForbidden(t *testing.T) {
	// Cookie-session owner POST without X-CSRF-Token → 403 csrf_invalid.
	f := &fakeService{}
	rr := sessionRequest(t, f, ownerActor, "", http.MethodPost, "/api/stores")
	status, code, _, _ := errContract(t, rr)
	if status != http.StatusForbidden || code != "csrf_invalid" {
		t.Errorf("got (%d, %q), want (403, csrf_invalid)", status, code)
	}
}

func TestOwnerMutation_WithCSRFTokenProceeds(t *testing.T) {
	// Cookie-session owner POST with the matching X-CSRF-Token proceeds.
	f := &fakeService{}
	f.createStore = func(_ context.Context, actorID string, in store.CreateStoreInput) (store.Store, error) {
		if actorID != ownerActor.ID {
			t.Errorf("actorID = %q, want %q", actorID, ownerActor.ID)
		}
		return store.Store{ID: "s1", Name: in.Name, Slug: "clinica"}, nil
	}
	req := httptest.NewRequest(http.MethodPost, "/api/stores", strings.NewReader(`{"name":"Clínica","address":"Av 1","specialty":"General"}`))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(&http.Cookie{Name: config.SessionCookie, Value: "raw-token"})
	req.Header.Set("X-CSRF-Token", "csrf-token")
	f.authenticateSession = func(_ context.Context, _ string) (store.Actor, error) { return ownerActor, nil }
	f.sessionCSRF = func(_ context.Context, _ string) (string, error) { return "csrf-token", nil }
	rr := httptest.NewRecorder()
	h := newTestRouter(t, f)
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusCreated {
		t.Fatalf("status %d, want 201", rr.Code)
	}
}

func TestUserActor_OwnerRouteForbidden(t *testing.T) {
	// A USER with a valid session is rejected by RequireRole before any
	// handler runs.
	f := &fakeService{}
	rr := sessionRequest(t, f, userActor, "csrf-token", http.MethodGet, "/api/stores")
	status, code, _, _ := errContract(t, rr)
	if status != http.StatusForbidden || code != "forbidden" {
		t.Errorf("got (%d, %q), want (403, forbidden)", status, code)
	}
}

func TestUserActor_MeAllowedOutsideOwnerGroup(t *testing.T) {
	// /api/auth/me sits outside the owner group: a USER may read its own
	// profile.
	f := &fakeService{}
	f.me = func(_ context.Context, actorID string) (store.User, error) {
		return store.User{ID: userActor.ID, Name: userActor.Name, Email: userActor.Email, Role: userActor.Role}, nil
	}
	rr := sessionRequest(t, f, userActor, "", http.MethodGet, "/api/auth/me")
	if rr.Code != http.StatusOK {
		t.Fatalf("status %d, want 200", rr.Code)
	}
}

func TestLogout_RequiresCSRFWithSessionButAnonymousStays204(t *testing.T) {
	// Anonymous logout has no session, so CSRF is skipped and the idempotent
	// 204 is returned.
	f := &fakeService{}
	h := newTestRouter(t, f)
	rr := doRequest(t, h, http.MethodPost, "/api/auth/logout", "")
	if rr.Code != http.StatusNoContent {
		t.Fatalf("anonymous logout status %d, want 204", rr.Code)
	}

	// Session-authenticated logout without the CSRF header is blocked.
	rr2 := sessionRequest(t, f, userActor, "", http.MethodPost, "/api/auth/logout")
	status, code, _, _ := errContract(t, rr2)
	if status != http.StatusForbidden || code != "csrf_invalid" {
		t.Errorf("session logout without CSRF: got (%d, %q), want (403, csrf_invalid)", status, code)
	}
}

func TestOwnerRoute_NoCredentials401(t *testing.T) {
	// No session cookie and no X-API-Key → 401 unauthorized.
	f := &fakeService{}
	h := newTestRouter(t, f)
	req := httptest.NewRequest(http.MethodGet, "/api/stores", nil)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	status, code, _, _ := errContract(t, rr)
	if status != http.StatusUnauthorized || code != "unauthorized" {
		t.Errorf("got (%d, %q), want (401, unauthorized)", status, code)
	}
}

func TestAuthRoutes_PublicWithoutAuth(t *testing.T) {
	// register and login are public: no credentials required.
	f := &fakeService{}
	f.register = func(_ context.Context, _, _, _ string) (store.User, error) {
		return store.User{ID: "u1", Name: "Ana", Email: "ana@example.com", Role: store.RoleUser}, nil
	}
	f.login = func(_ context.Context, _, _ string) (store.User, service.SessionResult, error) {
		return store.User{ID: "u1", Name: "Ana", Email: "ana@example.com", Role: store.RoleUser},
			service.SessionResult{RawToken: "raw", CSRFToken: "csrf", ExpiresAt: sessionExpiry}, nil
	}
	h := newTestRouter(t, f)

	if rr := doRequest(t, h, http.MethodPost, "/api/auth/register", `{"name":"A","email":"a@e.com","password":"password123"}`); rr.Code != http.StatusCreated {
		t.Errorf("register status %d, want 201", rr.Code)
	}
	if rr := doRequest(t, h, http.MethodPost, "/api/auth/login", `{"email":"a@e.com","password":"password123"}`); rr.Code != http.StatusOK {
		t.Errorf("login status %d, want 200", rr.Code)
	}
}
