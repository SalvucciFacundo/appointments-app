package service

import (
	"context"
	"time"

	"github.com/salvuccifacundo/appointments-app/backend/internal/store"
)

// Options configures the Service. Zero values fall back to the defaults below,
// keeping the pre-auth NewService(db) call valid.
type Options struct {
	SessionTTL     time.Duration
	BootstrapID    string
	BootstrapEmail string
	Argon2Memory   uint32
	Argon2Time     uint32
}

// Defaults applied when the corresponding Options field is zero.
const (
	defaultSessionTTL   = 24 * time.Hour
	defaultBootstrapID  = "dashboard-owner"
	defaultArgon2Memory = 65536
	defaultArgon2Time   = 1
)

// authStore is the slice of the store the auth flow needs. It is an interface
// (defined consumer-side, like handlers.Service) so the auth service methods
// stay unit-testable against a fake store without a database. *store.DB
// implements it.
type authStore interface {
	CreateUser(ctx context.Context, in store.CreateUserInput) (store.User, error)
	GetUserByEmail(ctx context.Context, email string) (store.User, error)
	GetUserByID(ctx context.Context, id string) (store.User, error)
	EnsureBootstrapOwner(ctx context.Context, id, email string) (store.User, error)
	CreateSession(ctx context.Context, in store.CreateSessionInput) (store.Session, error)
	GetActorByTokenHash(ctx context.Context, tokenHash string) (store.Actor, error)
	DeleteSessionByTokenHash(ctx context.Context, tokenHash string) error
	DeleteExpiredSessions(ctx context.Context) error
}

// Service orchestrates business logic over the store data access layer. Pure
// helpers (AvailableSlots, ValidateTransition, validators) remain standalone
// functions; Service wires them to the database.
type Service struct {
	db   *store.DB
	auth authStore
	opts Options
}

// NewService constructs a Service backed by the given store. Options are
// optional: zero values fall back to the package defaults, so the original
// NewService(db) call remains valid.
func NewService(db *store.DB, opts ...Options) *Service {
	o := Options{}
	if len(opts) > 0 {
		o = opts[0]
	}
	if o.SessionTTL <= 0 {
		o.SessionTTL = defaultSessionTTL
	}
	if o.BootstrapID == "" {
		o.BootstrapID = defaultBootstrapID
	}
	if o.Argon2Memory == 0 {
		o.Argon2Memory = defaultArgon2Memory
	}
	if o.Argon2Time == 0 {
		o.Argon2Time = defaultArgon2Time
	}
	return &Service{db: db, auth: db, opts: o}
}
