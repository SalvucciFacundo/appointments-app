package service

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/salvuccifacundo/appointments-app/backend/internal/store"
)

// testBootstrapEmail is the bootstrap email the fake-backed services in this
// file are configured with.
const testBootstrapEmail = "owner@example.com"

// fakeAuthStore is an in-memory authStore used to test the auth service
// methods without a database. It mirrors the unique-constraint and missing-row
// behaviors of the real store.
type fakeAuthStore struct {
	byEmail   map[string]store.User
	byID      map[string]store.User
	sessions  map[string]store.Session
	createErr error
}

func newFakeAuthStore() *fakeAuthStore {
	return &fakeAuthStore{
		byEmail:  map[string]store.User{},
		byID:     map[string]store.User{},
		sessions: map[string]store.Session{},
	}
}

func (f *fakeAuthStore) CreateUser(_ context.Context, in store.CreateUserInput) (store.User, error) {
	if f.createErr != nil {
		return store.User{}, f.createErr
	}
	if _, ok := f.byEmail[in.Email]; ok {
		return store.User{}, &pgconn.PgError{Code: "23505", Message: "duplicate key value violates unique constraint \"users_email_key\""}
	}
	u := store.User{
		ID:            uuid.NewString(),
		Name:          in.Name,
		Email:         in.Email,
		Role:          in.Role,
		EmailVerified: false,
		PasswordHash:  in.PasswordHash,
	}
	f.byEmail[u.Email] = u
	f.byID[u.ID] = u
	return u, nil
}

func (f *fakeAuthStore) GetUserByEmail(_ context.Context, email string) (store.User, error) {
	u, ok := f.byEmail[email]
	if !ok {
		return store.User{}, pgx.ErrNoRows
	}
	return u, nil
}

func (f *fakeAuthStore) GetUserByID(_ context.Context, id string) (store.User, error) {
	u, ok := f.byID[id]
	if !ok {
		return store.User{}, pgx.ErrNoRows
	}
	return u, nil
}

func (f *fakeAuthStore) EnsureBootstrapOwner(_ context.Context, id, email string) (store.User, error) {
	// Mirror the real store: the bootstrap email may already belong to a
	// registered user, which is promoted and returned.
	if u, ok := f.byEmail[email]; ok {
		u.Role = store.RoleOwner
		f.byEmail[email] = u
		f.byID[u.ID] = u
		return u, nil
	}
	if u, ok := f.byID[id]; ok {
		u.Email = email
		u.Role = store.RoleOwner
		f.byID[id] = u
		f.byEmail[email] = u
		return u, nil
	}
	u := store.User{ID: id, Name: "Dashboard Owner", Email: email, Role: store.RoleOwner}
	f.byID[id] = u
	f.byEmail[email] = u
	return u, nil
}

func (f *fakeAuthStore) CreateSession(_ context.Context, in store.CreateSessionInput) (store.Session, error) {
	s := store.Session{
		ID:        uuid.NewString(),
		UserID:    in.UserID,
		TokenHash: in.TokenHash,
		CSRFToken: in.CSRFToken,
		ExpiresAt: in.ExpiresAt,
		CreatedAt: time.Now(),
	}
	f.sessions[in.TokenHash] = s
	return s, nil
}

func (f *fakeAuthStore) GetActorByTokenHash(_ context.Context, tokenHash string) (store.Actor, error) {
	s, ok := f.sessions[tokenHash]
	if !ok || !s.ExpiresAt.After(time.Now()) {
		return store.Actor{}, pgx.ErrNoRows
	}
	u, ok := f.byID[s.UserID]
	if !ok {
		return store.Actor{}, pgx.ErrNoRows
	}
	return store.Actor{ID: u.ID, Name: u.Name, Email: u.Email, Role: u.Role}, nil
}

func (f *fakeAuthStore) GetSessionCSRF(_ context.Context, tokenHash string) (string, error) {
	s, ok := f.sessions[tokenHash]
	if !ok || !s.ExpiresAt.After(time.Now()) {
		return "", pgx.ErrNoRows
	}
	return s.CSRFToken, nil
}

func (f *fakeAuthStore) DeleteSessionByTokenHash(_ context.Context, tokenHash string) error {
	delete(f.sessions, tokenHash)
	return nil
}

func (f *fakeAuthStore) DeleteExpiredSessions(_ context.Context) error {
	for h, s := range f.sessions {
		if !s.ExpiresAt.After(time.Now()) {
			delete(f.sessions, h)
		}
	}
	return nil
}

// testAuthService builds a Service backed by the fake store. The Argon2 memory
// is lowered to keep the suite fast; verification parses parameters from the
// encoded hash, so the auth logic is unaffected.
func testAuthService(f *fakeAuthStore) *Service {
	svc := NewService(nil, Options{
		SessionTTL:     24 * time.Hour,
		BootstrapID:    "dashboard-owner",
		BootstrapEmail: testBootstrapEmail,
		Argon2Memory:   4096,
		Argon2Time:     1,
	})
	svc.auth = f
	return svc
}

func TestRegister_SuccessNormalizesEmailAndHashesPassword(t *testing.T) {
	f := newFakeAuthStore()
	svc := testAuthService(f)
	ctx := context.Background()

	user, err := svc.Register(ctx, "  Ana Gomez ", "  Ana@Example.COM ", "password123")
	if err != nil {
		t.Fatalf("Register: %v", err)
	}
	if user.Email != "ana@example.com" {
		t.Errorf("email = %q, want normalized lowercase", user.Email)
	}
	if user.Name != "Ana Gomez" {
		t.Errorf("name = %q, want trimmed", user.Name)
	}
	if user.Role != store.RoleUser {
		t.Errorf("role = %s, want USER", user.Role)
	}
	if user.EmailVerified {
		t.Error("emailVerified = true, want false")
	}
	if err := VerifyPassword(user.PasswordHash, "password123"); err != nil {
		t.Errorf("stored hash does not verify: %v", err)
	}
}

func TestRegister_BootstrapEmailGetsOwnerRole(t *testing.T) {
	f := newFakeAuthStore()
	svc := testAuthService(f)
	ctx := context.Background()

	user, err := svc.Register(ctx, "Owner", testBootstrapEmail, "password123")
	if err != nil {
		t.Fatalf("Register: %v", err)
	}
	if user.Role != store.RoleOwner {
		t.Errorf("role = %s, want OWNER", user.Role)
	}
}

func TestRegister_ValidationErrors(t *testing.T) {
	f := newFakeAuthStore()
	svc := testAuthService(f)
	ctx := context.Background()

	_, err := svc.Register(ctx, "", "a@example.com", "password123")
	var fe *FieldError
	if !errors.As(err, &fe) || fe.Field != "name" {
		t.Errorf("empty name error = %v, want FieldError{field=name}", err)
	}

	_, err = svc.Register(ctx, "Ana", "not-an-email", "password123")
	if !errors.As(err, &fe) || fe.Field != "email" {
		t.Errorf("bad email error = %v, want FieldError{field=email}", err)
	}

	_, err = svc.Register(ctx, "Ana", "ana@example.com", "1234")
	if !errors.As(err, &fe) || fe.Field != "password" {
		t.Errorf("short password error = %v, want FieldError{field=password}", err)
	}

	if len(f.byEmail) != 0 {
		t.Error("validation failures must not create users")
	}
}

func TestRegister_DuplicateEmailReturnsConflict(t *testing.T) {
	f := newFakeAuthStore()
	svc := testAuthService(f)
	ctx := context.Background()

	if _, err := svc.Register(ctx, "Ana", "ana@example.com", "password123"); err != nil {
		t.Fatalf("first Register: %v", err)
	}

	_, err := svc.Register(ctx, "Other", "ANA@example.com", "password123")
	var ce *ConflictError
	if !errors.As(err, &ce) || ce.Code != "email_taken" {
		t.Errorf("duplicate error = %v, want ConflictError{code=email_taken}", err)
	}
}

func TestLogin_UnknownEmailAndWrongPasswordAreIndistinguishable(t *testing.T) {
	f := newFakeAuthStore()
	svc := testAuthService(f)
	ctx := context.Background()

	if _, err := svc.Register(ctx, "Ana", "ana@example.com", "password123"); err != nil {
		t.Fatalf("Register: %v", err)
	}

	_, _, errUnknown := svc.Login(ctx, "ghost@example.com", "password123")
	_, _, errWrongPass := svc.Login(ctx, "ana@example.com", "wrong-password")
	if !errors.Is(errUnknown, ErrInvalidCredentials) {
		t.Errorf("unknown email error = %v, want ErrInvalidCredentials", errUnknown)
	}
	if !errors.Is(errWrongPass, ErrInvalidCredentials) {
		t.Errorf("wrong password error = %v, want ErrInvalidCredentials", errWrongPass)
	}
	if errUnknown == nil || errWrongPass == nil || errUnknown.Error() != errWrongPass.Error() {
		t.Errorf("errors differ: %q vs %q, want identical", errUnknown, errWrongPass)
	}
	if len(f.sessions) != 0 {
		t.Error("failed logins must not create sessions")
	}
}

func TestLogin_UserWithoutPasswordRejected(t *testing.T) {
	f := newFakeAuthStore()
	svc := testAuthService(f)
	ctx := context.Background()

	// Legacy user with credentials-less row, as the bootstrap/legacy users are.
	f.byEmail["legacy@example.com"] = store.User{ID: "u1", Name: "Legacy", Email: "legacy@example.com", Role: store.RoleUser}

	_, _, err := svc.Login(ctx, "legacy@example.com", "anything")
	if !errors.Is(err, ErrInvalidCredentials) {
		t.Errorf("error = %v, want ErrInvalidCredentials", err)
	}
}

func TestLogin_SuccessCreatesSession(t *testing.T) {
	f := newFakeAuthStore()
	svc := testAuthService(f)
	ctx := context.Background()

	if _, err := svc.Register(ctx, "Ana", "ana@example.com", "password123"); err != nil {
		t.Fatalf("Register: %v", err)
	}

	user, res, err := svc.Login(ctx, "ana@example.com", "password123")
	if err != nil {
		t.Fatalf("Login: %v", err)
	}
	if user.Email != "ana@example.com" {
		t.Errorf("email = %q, want ana@example.com", user.Email)
	}
	if len(res.RawToken) != 64 || len(res.CSRFToken) != 64 {
		t.Errorf("token lengths = %d/%d, want 64/64", len(res.RawToken), len(res.CSRFToken))
	}
	if res.RawToken == res.CSRFToken {
		t.Error("raw token equals csrf token")
	}
	wantExpiry := time.Now().Add(24 * time.Hour)
	if d := res.ExpiresAt.Sub(wantExpiry); d < -time.Second || d > time.Second {
		t.Errorf("expiresAt = %v, want ~%v", res.ExpiresAt, wantExpiry)
	}
	// The session is stored keyed by the SHA-256 of the raw token, never raw.
	if _, ok := f.sessions[sha256Hex(res.RawToken)]; !ok {
		t.Error("session not stored under token hash")
	}
	if len(f.sessions) != 1 {
		t.Errorf("session count = %d, want 1", len(f.sessions))
	}
}

func TestAuthenticateSession_ValidTokenReturnsActor(t *testing.T) {
	f := newFakeAuthStore()
	svc := testAuthService(f)
	ctx := context.Background()

	if _, err := svc.Register(ctx, "Ana", "ana@example.com", "password123"); err != nil {
		t.Fatalf("Register: %v", err)
	}
	_, res, err := svc.Login(ctx, "ana@example.com", "password123")
	if err != nil {
		t.Fatalf("Login: %v", err)
	}

	actor, err := svc.AuthenticateSession(ctx, res.RawToken)
	if err != nil {
		t.Fatalf("AuthenticateSession: %v", err)
	}
	if actor.Email != "ana@example.com" || actor.Role != store.RoleUser {
		t.Errorf("actor = %+v, want ana@example.com/USER", actor)
	}
}

func TestAuthenticateSession_ExpiredReturnsUnauthorized(t *testing.T) {
	f := newFakeAuthStore()
	svc := testAuthService(f)
	ctx := context.Background()

	// Seed a session that already expired.
	f.sessions[sha256Hex("expired-token")] = store.Session{
		ID:        uuid.NewString(),
		UserID:    "u1",
		TokenHash: sha256Hex("expired-token"),
		CSRFToken: "csrf",
		ExpiresAt: time.Now().Add(-time.Hour),
		CreatedAt: time.Now().Add(-2 * time.Hour),
	}

	_, err := svc.AuthenticateSession(ctx, "expired-token")
	if !errors.Is(err, ErrUnauthorized) {
		t.Errorf("error = %v, want ErrUnauthorized", err)
	}
}

func TestAuthenticateSession_UnknownTokenReturnsUnauthorized(t *testing.T) {
	f := newFakeAuthStore()
	svc := testAuthService(f)
	ctx := context.Background()

	_, err := svc.AuthenticateSession(ctx, "no-such-token")
	if !errors.Is(err, ErrUnauthorized) {
		t.Errorf("error = %v, want ErrUnauthorized", err)
	}
}

func TestLogout_Idempotent(t *testing.T) {
	f := newFakeAuthStore()
	svc := testAuthService(f)
	ctx := context.Background()

	if _, err := svc.Register(ctx, "Ana", "ana@example.com", "password123"); err != nil {
		t.Fatalf("Register: %v", err)
	}
	_, res, err := svc.Login(ctx, "ana@example.com", "password123")
	if err != nil {
		t.Fatalf("Login: %v", err)
	}

	if err := svc.Logout(ctx, res.RawToken); err != nil {
		t.Fatalf("Logout: %v", err)
	}
	if len(f.sessions) != 0 {
		t.Errorf("sessions after logout = %d, want 0", len(f.sessions))
	}
	// Logout again (already gone) and with an empty token must not error.
	if err := svc.Logout(ctx, res.RawToken); err != nil {
		t.Errorf("Logout(again) = %v, want nil", err)
	}
	if err := svc.Logout(ctx, ""); err != nil {
		t.Errorf("Logout(empty) = %v, want nil", err)
	}
}

func TestBootstrapOwner_EnsuresLegacyOwner(t *testing.T) {
	f := newFakeAuthStore()
	svc := testAuthService(f)
	ctx := context.Background()

	actor, err := svc.BootstrapOwner(ctx)
	if err != nil {
		t.Fatalf("BootstrapOwner: %v", err)
	}
	if actor.ID != "dashboard-owner" {
		t.Errorf("id = %q, want bootstrap id dashboard-owner", actor.ID)
	}
	if actor.Role != store.RoleOwner {
		t.Errorf("role = %s, want OWNER", actor.Role)
	}
	if actor.Email != testBootstrapEmail {
		t.Errorf("email = %q, want %q", actor.Email, testBootstrapEmail)
	}

	// Idempotent: a second call returns the same actor.
	again, err := svc.BootstrapOwner(ctx)
	if err != nil {
		t.Fatalf("BootstrapOwner(again): %v", err)
	}
	if again.ID != actor.ID || again.Email != actor.Email {
		t.Errorf("second call changed actor: %+v vs %+v", again, actor)
	}
}

func TestBootstrapOwner_ReturnsRegisteredOwnerForBootstrapEmail(t *testing.T) {
	f := newFakeAuthStore()
	svc := testAuthService(f)
	ctx := context.Background()

	// A user registers with the bootstrap email (role OWNER per Register).
	registered, err := svc.Register(ctx, "Owner", testBootstrapEmail, "password123")
	if err != nil {
		t.Fatalf("Register: %v", err)
	}
	if registered.Role != store.RoleOwner {
		t.Fatalf("role = %s, want OWNER", registered.Role)
	}

	// The API-key fallback maps to the same actor: the registered user, not a
	// fresh row with the legacy id (which would collide on the unique email).
	actor, err := svc.BootstrapOwner(ctx)
	if err != nil {
		t.Fatalf("BootstrapOwner: %v", err)
	}
	if actor.ID != registered.ID {
		t.Errorf("actor id = %q, want registered user id %q", actor.ID, registered.ID)
	}
	if actor.Email != testBootstrapEmail || actor.Role != store.RoleOwner {
		t.Errorf("actor = %+v, want owner@example.com/OWNER", actor)
	}
	if len(f.byID) != 1 {
		t.Errorf("user count = %d, want 1 (no duplicate owner row)", len(f.byID))
	}
}

func TestCleanupExpiredSessions_RemovesOnlyExpired(t *testing.T) {
	f := newFakeAuthStore()
	svc := testAuthService(f)
	ctx := context.Background()

	f.sessions["expired"] = store.Session{
		ID: uuid.NewString(), UserID: "u1", TokenHash: "expired",
		CSRFToken: "c", ExpiresAt: time.Now().Add(-time.Minute), CreatedAt: time.Now().Add(-time.Hour),
	}
	f.sessions["valid"] = store.Session{
		ID: uuid.NewString(), UserID: "u1", TokenHash: "valid",
		CSRFToken: "c", ExpiresAt: time.Now().Add(time.Hour), CreatedAt: time.Now(),
	}

	if err := svc.CleanupExpiredSessions(ctx); err != nil {
		t.Fatalf("CleanupExpiredSessions: %v", err)
	}
	if _, ok := f.sessions["expired"]; ok {
		t.Error("expired session still present after cleanup")
	}
	if _, ok := f.sessions["valid"]; !ok {
		t.Error("valid session removed by cleanup")
	}
}

func TestRegister_PropagatesStoreErrors(t *testing.T) {
	f := newFakeAuthStore()
	f.createErr = errors.New("db down")
	svc := testAuthService(f)
	ctx := context.Background()

	_, err := svc.Register(ctx, "Ana", "ana@example.com", "password123")
	if err == nil || strings.Contains(err.Error(), "email_taken") {
		t.Errorf("error = %v, want db error propagated", err)
	}
}
