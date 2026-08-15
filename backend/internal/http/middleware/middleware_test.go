package middleware

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
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
	h := RateLimit("secret-key")(okHandler())

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
	h := RateLimit("secret-key")(okHandler())
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
	h := RateLimit("secret-key")(okHandler())

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

func TestRequireAPIKey_401WithoutKey(t *testing.T) {
	h := RequireAPIKey("secret-key")(okHandler())
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, newRequest("203.0.113.5:1234"))
	status, code, _ := decodeErrorBody(t, rr)
	if status != http.StatusUnauthorized || code != "unauthorized" {
		t.Errorf("error contract = (%d, %q), want (401, unauthorized)", status, code)
	}
}

func TestRequireAPIKey_401WithWrongKey(t *testing.T) {
	h := RequireAPIKey("secret-key")(okHandler())
	rr := httptest.NewRecorder()
	r := newRequest("203.0.113.5:1234")
	r.Header.Set("X-API-Key", "wrong-key")
	h.ServeHTTP(rr, r)
	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("status %d, want 401", rr.Code)
	}
}

func TestRequireAPIKey_AllowsValidKey(t *testing.T) {
	h := RequireAPIKey("secret-key")(okHandler())
	rr := httptest.NewRecorder()
	r := newRequest("203.0.113.5:1234")
	r.Header.Set("X-API-Key", "secret-key")
	h.ServeHTTP(rr, r)
	if rr.Code != http.StatusOK {
		t.Fatalf("status %d, want 200", rr.Code)
	}
}

func TestRequireAPIKey_DisabledWhenKeyEmpty(t *testing.T) {
	h := RequireAPIKey("")(okHandler())
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, newRequest("203.0.113.5:1234"))
	if rr.Code != http.StatusOK {
		t.Fatalf("status %d, want 200 (empty apiKey disables the check)", rr.Code)
	}
}
