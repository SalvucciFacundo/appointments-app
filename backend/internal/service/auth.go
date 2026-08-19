package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/salvuccifacundo/appointments-app/backend/internal/store"
)

// SessionResult carries the values a successful Login hands to the HTTP layer
// to set the session and CSRF cookies.
type SessionResult struct {
	RawToken  string
	CSRFToken string
	ExpiresAt time.Time
}

// Register creates a new user with role USER (OWNER only when the email
// matches the configured bootstrap email). The email is normalized to
// lowercase and the password must be at least 8 characters.
func (s *Service) Register(ctx context.Context, name, email, password string) (store.User, error) {
	if strings.TrimSpace(name) == "" {
		return store.User{}, &FieldError{Field: "name", Message: "name is required"}
	}
	email = normalizeEmail(email)
	if err := ValidateEmail(email); err != nil {
		return store.User{}, &FieldError{Field: "email", Message: err.Error()}
	}
	if len(password) < 8 {
		return store.User{}, &FieldError{Field: "password", Message: "password must be at least 8 characters"}
	}

	passwordHash, err := HashPassword(password, s.opts.Argon2Memory, s.opts.Argon2Time)
	if err != nil {
		return store.User{}, err
	}

	role := store.RoleUser
	if email == s.opts.BootstrapEmail {
		role = store.RoleOwner
	}

	verificationToken, err := NewToken()
	if err != nil {
		return store.User{}, err
	}

	user, err := s.auth.CreateUser(ctx, store.CreateUserInput{
		Name:              strings.TrimSpace(name),
		Email:             email,
		PasswordHash:      passwordHash,
		Role:              role,
		VerificationToken: verificationToken,
	})
	if err != nil {
		if store.IsUniqueViolation(err) {
			return store.User{}, &ConflictError{
				Code:    "email_taken",
				Message: "an account with this email already exists",
			}
		}
		return store.User{}, err
	}
	return user, nil
}

// Login verifies the credentials and, on success, creates a session whose raw
// token is returned for the session cookie. Unknown emails and wrong
// passwords both map to ErrInvalidCredentials.
func (s *Service) Login(ctx context.Context, email, password string) (store.User, SessionResult, error) {
	user, err := s.auth.GetUserByEmail(ctx, normalizeEmail(email))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return store.User{}, SessionResult{}, ErrInvalidCredentials
		}
		return store.User{}, SessionResult{}, err
	}
	if err := VerifyPassword(user.PasswordHash, password); err != nil {
		return store.User{}, SessionResult{}, ErrInvalidCredentials
	}

	res, err := s.newSession(ctx, user.ID)
	if err != nil {
		return store.User{}, SessionResult{}, err
	}
	return user, res, nil
}

// IssueSession creates a session for the given user id and returns the raw
// token, CSRF token, and expiry for the HTTP layer to set as cookies. It is
// used to sign a user in right after registration (auto-login).
func (s *Service) IssueSession(ctx context.Context, userID string) (SessionResult, error) {
	return s.newSession(ctx, userID)
}

// newSession creates a session for the given user and returns the raw token,
// CSRF token, and expiry. The raw token is stored hashed (SHA-256); the CSRF
// token is bound to the same session for double-submit validation.
func (s *Service) newSession(ctx context.Context, userID string) (SessionResult, error) {
	rawToken, err := NewToken()
	if err != nil {
		return SessionResult{}, err
	}
	csrfToken, err := NewCSRFToken()
	if err != nil {
		return SessionResult{}, err
	}
	expiresAt := time.Now().Add(s.opts.SessionTTL)
	if _, err := s.auth.CreateSession(ctx, store.CreateSessionInput{
		UserID:    userID,
		TokenHash: sha256Hex(rawToken),
		CSRFToken: csrfToken,
		ExpiresAt: expiresAt,
	}); err != nil {
		return SessionResult{}, err
	}
	return SessionResult{RawToken: rawToken, CSRFToken: csrfToken, ExpiresAt: expiresAt}, nil
}

// Logout invalidates the session for the given raw token. It is idempotent: an
// empty or unknown token is not an error.
func (s *Service) Logout(ctx context.Context, rawToken string) error {
	if rawToken == "" {
		return nil
	}
	return s.auth.DeleteSessionByTokenHash(ctx, sha256Hex(rawToken))
}

// Me returns the full profile for the authenticated actor id.
func (s *Service) Me(ctx context.Context, actorID string) (store.User, error) {
	user, err := s.auth.GetUserByID(ctx, actorID)
	if err != nil {
		return store.User{}, notFoundIfNoRows(err)
	}
	return user, nil
}

// AuthenticateSession resolves the authenticated actor from the raw session
// token. The token is hashed with SHA-256 before the store lookup, so the raw
// value never reaches the database. Expired, revoked, or absent sessions map
// to ErrUnauthorized.
func (s *Service) AuthenticateSession(ctx context.Context, rawToken string) (store.Actor, error) {
	if rawToken == "" {
		return store.Actor{}, ErrUnauthorized
	}
	actor, err := s.auth.GetActorByTokenHash(ctx, sha256Hex(rawToken))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return store.Actor{}, ErrUnauthorized
		}
		return store.Actor{}, err
	}
	return actor, nil
}

// SessionCSRFToken returns the CSRF token bound to the session for the given
// raw token. The Session middleware uses it to validate double-submit CSRF on
// cookie-authenticated mutations.
func (s *Service) SessionCSRFToken(ctx context.Context, rawToken string) (string, error) {
	if rawToken == "" {
		return "", ErrUnauthorized
	}
	return s.auth.GetSessionCSRF(ctx, sha256Hex(rawToken))
}

// BootstrapOwner ensures the legacy owner user exists (id = Options.BootstrapID,
// email = Options.BootstrapEmail, role OWNER, no password) and returns it as
// the authenticated actor. The X-API-Key stub maps onto this actor during the
// transition.
func (s *Service) BootstrapOwner(ctx context.Context) (store.Actor, error) {
	user, err := s.auth.EnsureBootstrapOwner(ctx, s.opts.BootstrapID, s.opts.BootstrapEmail)
	if err != nil {
		return store.Actor{}, err
	}
	return store.Actor{ID: user.ID, Name: user.Name, Email: user.Email, Role: user.Role}, nil
}

// CleanupExpiredSessions removes sessions past their expiry. It is called by
// a periodic goroutine in the HTTP entrypoint.
func (s *Service) CleanupExpiredSessions(ctx context.Context) error {
	return s.auth.DeleteExpiredSessions(ctx)
}

// normalizeEmail lowercases and trims an email for storage and lookup.
func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

// sha256Hex returns the hex-encoded SHA-256 digest of s.
func sha256Hex(s string) string {
	sum := sha256.Sum256([]byte(s))
	return hex.EncodeToString(sum[:])
}
