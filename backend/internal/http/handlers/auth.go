package handlers

import (
	"net/http"
	"time"

	"github.com/salvuccifacundo/appointments-app/backend/internal/config"
	"github.com/salvuccifacundo/appointments-app/backend/internal/http/middleware"
	"github.com/salvuccifacundo/appointments-app/backend/internal/store"
)

// userProfile is the {id,name,email,role} shape returned by register, login
// and me. The stored User also carries emailVerified; the auth contract only
// exposes the four fields below.
type userProfile struct {
	ID    string     `json:"id"`
	Name  string     `json:"name"`
	Email string     `json:"email"`
	Role  store.Role `json:"role"`
}

// registerBody is the public registration payload.
type registerBody struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

// loginBody is the login payload.
type loginBody struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// Register handles POST /api/auth/register. The service normalizes the email,
// validates the password, hashes it with Argon2id, and assigns role USER
// (OWNER only for the bootstrap email).
func (h *Handlers) Register(w http.ResponseWriter, r *http.Request) {
	var body registerBody
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "validation", "invalid JSON body", "")
		return
	}
	user, err := h.svc.Register(r.Context(), body.Name, body.Email, body.Password)
	if err != nil {
		respondError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, userProfile{ID: user.ID, Name: user.Name, Email: user.Email, Role: user.Role})
}

// Login handles POST /api/auth/login, setting the HttpOnly session cookie and
// the readable CSRF cookie that mirrors the session-bound token.
func (h *Handlers) Login(w http.ResponseWriter, r *http.Request) {
	var body loginBody
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "validation", "invalid JSON body", "")
		return
	}
	user, res, err := h.svc.Login(r.Context(), body.Email, body.Password)
	if err != nil {
		respondError(w, err)
		return
	}
	h.setSessionCookies(w, res.RawToken, res.CSRFToken, res.ExpiresAt)
	writeJSON(w, http.StatusOK, userProfile{ID: user.ID, Name: user.Name, Email: user.Email, Role: user.Role})
}

// Logout handles POST /api/auth/logout: it invalidates the session and clears
// both cookies, answering 204 even without a valid session (idempotent).
func (h *Handlers) Logout(w http.ResponseWriter, r *http.Request) {
	raw := ""
	if c, err := r.Cookie(config.SessionCookie); err == nil {
		raw = c.Value
	}
	if err := h.svc.Logout(r.Context(), raw); err != nil {
		respondError(w, err)
		return
	}
	h.clearSessionCookies(w)
	w.WriteHeader(http.StatusNoContent)
}

// Me handles GET /api/auth/me, returning the authenticated user's profile.
// It is reachable by any authenticated role (the owner group's RequireRole is
// not applied here).
func (h *Handlers) Me(w http.ResponseWriter, r *http.Request) {
	actor := middleware.ActorFromContext(r.Context())
	if actor == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "authentication required", "")
		return
	}
	user, err := h.svc.Me(r.Context(), actor.ID)
	if err != nil {
		respondError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, userProfile{ID: user.ID, Name: user.Name, Email: user.Email, Role: user.Role})
}

// setSessionCookies writes the HttpOnly session cookie and the readable CSRF
// cookie bound to the same session. Both expire with the session TTL.
func (h *Handlers) setSessionCookies(w http.ResponseWriter, rawToken, csrfToken string, expiresAt time.Time) {
	maxAge := int(time.Until(expiresAt).Seconds())
	if maxAge < 0 {
		maxAge = 0
	}
	http.SetCookie(w, &http.Cookie{
		Name:     config.SessionCookie,
		Value:    rawToken,
		Path:     "/",
		HttpOnly: true,
		Secure:   h.cfg.CookieSecure,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   maxAge,
	})
	http.SetCookie(w, &http.Cookie{
		Name:     config.CsrfCookie,
		Value:    csrfToken,
		Path:     "/",
		Secure:   h.cfg.CookieSecure,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   maxAge,
	})
}

// clearSessionCookies expires both cookies so the browser drops them.
func (h *Handlers) clearSessionCookies(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{Name: config.SessionCookie, Value: "", Path: "/", MaxAge: -1})
	http.SetCookie(w, &http.Cookie{Name: config.CsrfCookie, Value: "", Path: "/", MaxAge: -1})
}
