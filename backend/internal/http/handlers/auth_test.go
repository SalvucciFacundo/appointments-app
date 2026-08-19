package handlers_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/salvuccifacundo/appointments-app/backend/internal/config"
	"github.com/salvuccifacundo/appointments-app/backend/internal/service"
	"github.com/salvuccifacundo/appointments-app/backend/internal/store"
)

// userProfileShape mirrors the handlers userProfile wire contract.
type userProfileShape struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
	Role  string `json:"role"`
}

// cookieByName finds a cookie in a response's Set-Cookie headers.
func cookieByName(t *testing.T, rr *httptest.ResponseRecorder, name string) *http.Cookie {
	t.Helper()
	for _, c := range rr.Result().Cookies() {
		if c.Name == name {
			return c
		}
	}
	t.Fatalf("cookie %q not set in %v", name, rr.Result().Cookies())
	return nil
}

func TestRegister_SuccessReturns201Profile(t *testing.T) {
	f := &fakeService{}
	f.register = func(_ context.Context, name, email, password string) (store.User, error) {
		if name != "Ana" || email != "ana@example.com" || password != "password123" {
			t.Errorf("args = (%q, %q, %q), want (Ana, ana@example.com, password123)", name, email, password)
		}
		return store.User{ID: "u1", Name: name, Email: email, Role: store.RoleUser}, nil
	}
	h := newTestRouter(t, f)
	body := `{"name":"Ana","email":"ana@example.com","password":"password123"}`
	rr := doRequest(t, h, http.MethodPost, "/api/auth/register", body)

	if rr.Code != http.StatusCreated {
		t.Fatalf("status %d, want 201", rr.Code)
	}
	var got userProfileShape
	if err := json.Unmarshal(rr.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if got.Email != "ana@example.com" || got.Role != "USER" {
		t.Errorf("profile = %+v, want ana@example.com/USER", got)
	}
}

func TestRegister_ValidationError400(t *testing.T) {
	f := &fakeService{}
	f.register = func(_ context.Context, _, _, _ string) (store.User, error) {
		return store.User{}, &service.FieldError{Field: "password", Message: "password must be at least 8 characters"}
	}
	h := newTestRouter(t, f)
	rr := doRequest(t, h, http.MethodPost, "/api/auth/register", `{"name":"Ana","email":"a@example.com","password":"1234"}`)
	status, code, field, _ := errContract(t, rr)
	if status != http.StatusBadRequest || code != "validation" || field != "password" {
		t.Errorf("got (%d, %q, %q), want (400, validation, password)", status, code, field)
	}
}

func TestRegister_DuplicateEmail409(t *testing.T) {
	f := &fakeService{}
	f.register = func(_ context.Context, _, _, _ string) (store.User, error) {
		return store.User{}, &service.ConflictError{Code: "email_taken", Message: "an account with this email already exists"}
	}
	h := newTestRouter(t, f)
	rr := doRequest(t, h, http.MethodPost, "/api/auth/register", `{"name":"Ana","email":"ana@example.com","password":"password123"}`)
	status, code, _, _ := errContract(t, rr)
	if status != http.StatusConflict || code != "email_taken" {
		t.Errorf("got (%d, %q), want (409, email_taken)", status, code)
	}
}

func TestLogin_SuccessSetsSessionAndCSRFCookies(t *testing.T) {
	f := &fakeService{}
	f.login = func(_ context.Context, email, password string) (store.User, service.SessionResult, error) {
		if email != "ana@example.com" || password != "password123" {
			t.Errorf("args = (%q, %q), want (ana@example.com, password123)", email, password)
		}
		return store.User{ID: "u1", Name: "Ana", Email: email, Role: store.RoleUser},
			service.SessionResult{RawToken: "raw-token", CSRFToken: "csrf-token", ExpiresAt: time.Now().Add(time.Hour)}, nil
	}
	h := newTestRouter(t, f)
	body := `{"email":"ana@example.com","password":"password123"}`
	rr := doRequest(t, h, http.MethodPost, "/api/auth/login", body)

	if rr.Code != http.StatusOK {
		t.Fatalf("status %d, want 200", rr.Code)
	}
	session := cookieByName(t, rr, config.SessionCookie)
	if session.Value != "raw-token" {
		t.Errorf("session cookie = %q, want raw-token", session.Value)
	}
	if !session.HttpOnly {
		t.Error("session cookie must be HttpOnly")
	}
	if session.SameSite != http.SameSiteLaxMode {
		t.Errorf("session SameSite = %v, want Lax", session.SameSite)
	}
	if session.Secure {
		t.Error("session Secure = true, want false (COOKIE_SECURE=false in dev/test)")
	}
	csrf := cookieByName(t, rr, config.CsrfCookie)
	if csrf.Value != "csrf-token" {
		t.Errorf("csrf cookie = %q, want csrf-token", csrf.Value)
	}
	if csrf.HttpOnly {
		t.Error("csrf cookie must be readable by JS (not HttpOnly)")
	}
}

func TestLogin_InvalidCredentials401(t *testing.T) {
	f := &fakeService{}
	f.login = func(_ context.Context, _, _ string) (store.User, service.SessionResult, error) {
		return store.User{}, service.SessionResult{}, service.ErrInvalidCredentials
	}
	h := newTestRouter(t, f)
	rr := doRequest(t, h, http.MethodPost, "/api/auth/login", `{"email":"ana@example.com","password":"wrong"}`)
	status, code, _, _ := errContract(t, rr)
	if status != http.StatusUnauthorized || code != "invalid_credentials" {
		t.Errorf("got (%d, %q), want (401, invalid_credentials)", status, code)
	}
}

func TestLogout_NoContentAndClearsCookies(t *testing.T) {
	var loggedOut string
	f := &fakeService{}
	f.logout = func(_ context.Context, raw string) error {
		loggedOut = raw
		return nil
	}
	h := newTestRouter(t, f)

	req := httptest.NewRequest(http.MethodPost, "/api/auth/logout", nil)
	req.AddCookie(&http.Cookie{Name: config.SessionCookie, Value: "raw-token"})
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)

	if rr.Code != http.StatusNoContent {
		t.Fatalf("status %d, want 204", rr.Code)
	}
	if loggedOut != "raw-token" {
		t.Errorf("logout raw token = %q, want raw-token", loggedOut)
	}
	if c := cookieByName(t, rr, config.SessionCookie); c.MaxAge >= 0 {
		t.Errorf("session cookie MaxAge = %d, want negative (cleared)", c.MaxAge)
	}
	if c := cookieByName(t, rr, config.CsrfCookie); c.MaxAge >= 0 {
		t.Errorf("csrf cookie MaxAge = %d, want negative (cleared)", c.MaxAge)
	}
}

func TestMe_AuthenticatedReturnsProfile(t *testing.T) {
	f := &fakeService{}
	f.me = func(_ context.Context, actorID string) (store.User, error) {
		if actorID != "u1" {
			t.Errorf("actorID = %q, want u1", actorID)
		}
		return store.User{ID: "u1", Name: "Ana", Email: "ana@example.com", Role: store.RoleUser}, nil
	}
	rr := sessionRequest(t, f, store.Actor{ID: "u1", Name: "Ana", Email: "ana@example.com", Role: store.RoleUser}, "", http.MethodGet, "/api/auth/me")

	if rr.Code != http.StatusOK {
		t.Fatalf("status %d, want 200", rr.Code)
	}
	var got userProfileShape
	if err := json.Unmarshal(rr.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if got.Email != "ana@example.com" || got.Role != "USER" {
		t.Errorf("profile = %+v, want ana@example.com/USER", got)
	}
}

func TestMe_Anonymous401(t *testing.T) {
	h := newTestRouter(t, &fakeService{})
	rr := doRequest(t, h, http.MethodGet, "/api/auth/me", "")
	status, code, _, _ := errContract(t, rr)
	if status != http.StatusUnauthorized || code != "unauthorized" {
		t.Errorf("got (%d, %q), want (401, unauthorized)", status, code)
	}
}

// sessionRequest builds a request authenticated by a cookie session that the
// fake service resolves to the given actor with the given CSRF token.
func sessionRequest(t *testing.T, f *fakeService, actor store.Actor, csrf, method, path string) *httptest.ResponseRecorder {
	t.Helper()
	f.authenticateSession = func(_ context.Context, raw string) (store.Actor, error) {
		return actor, nil
	}
	f.sessionCSRF = func(_ context.Context, raw string) (string, error) {
		return csrf, nil
	}
	req := httptest.NewRequest(method, path, nil)
	req.AddCookie(&http.Cookie{Name: config.SessionCookie, Value: "raw-token"})
	if csrf != "" {
		req.Header.Set("X-CSRF-Token", csrf)
	}
	rr := httptest.NewRecorder()
	h := newTestRouter(t, f)
	h.ServeHTTP(rr, req)
	return rr
}
