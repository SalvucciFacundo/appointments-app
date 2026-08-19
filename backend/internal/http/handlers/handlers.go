// Package handlers contains the thin HTTP layer: each handler parses the
// request, calls the service, and writes the response. Business logic lives
// in the service package; handlers never touch the database.
package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/salvuccifacundo/appointments-app/backend/internal/http/middleware"
	"github.com/salvuccifacundo/appointments-app/backend/internal/service"
	"github.com/salvuccifacundo/appointments-app/backend/internal/store"
)

// Service is the slice of the business layer the handlers consume. It is
// defined here (consumer side) so handlers can be tested against a fake
// without a database.
type Service interface {
	// Auth flow.
	Register(ctx context.Context, name, email, password string) (store.User, error)
	IssueSession(ctx context.Context, userID string) (service.SessionResult, error)
	Login(ctx context.Context, email, password string) (store.User, service.SessionResult, error)
	Logout(ctx context.Context, rawToken string) error
	Me(ctx context.Context, actorID string) (store.User, error)
	AuthenticateSession(ctx context.Context, rawToken string) (store.Actor, error)
	SessionCSRFToken(ctx context.Context, rawToken string) (string, error)
	BootstrapOwner(ctx context.Context) (store.Actor, error)

	// Public surface.
	ListPublicStores(ctx context.Context, q, specialty string, page, limit int) ([]store.Store, int, error)
	GetPublicStore(ctx context.Context, slug string) (store.Store, []store.BusinessHour, error)
	GetSlots(ctx context.Context, slug, date string) ([]service.TimeSlot, error)
	Book(ctx context.Context, slug string, in service.BookInput) (*store.Appointment, error)

	// Owner-scoped surface. Actor-scoped methods take the authenticated
	// actor id first; the service verifies stores.owner_id.
	ListStoresByOwner(ctx context.Context, actorID string) ([]store.StoreDetail, error)
	CreateStore(ctx context.Context, actorID string, in store.CreateStoreInput) (store.Store, error)
	GetStore(ctx context.Context, actorID, id string) (store.StoreDetail, error)
	UpdateStore(ctx context.Context, actorID, id string, in store.UpdateStoreInput) (store.Store, error)
	ReplaceBusinessHours(ctx context.Context, actorID, storeID string, in []store.BusinessHourInput) ([]store.BusinessHour, error)
	CreateBlockedDate(ctx context.Context, actorID, storeID, date, reason string) (store.BlockedDate, error)
	DeleteBlockedDate(ctx context.Context, actorID, storeID, id string) error
	ListAppointments(ctx context.Context, actorID, storeID, date string, status *store.AppointmentStatus) ([]store.Appointment, error)
	CreateAppointment(ctx context.Context, actorID, storeID string, in service.CreateAppointmentInput) (store.Appointment, error)
	UpdateAppointmentStatus(ctx context.Context, actorID, storeID, apptID, action string) (store.Appointment, error)
	RescheduleAppointment(ctx context.Context, actorID, storeID, apptID, date, time string) (store.Appointment, error)
}

// Config carries the cookie behavior the handlers need to set session cookies.
type Config struct {
	CookieSecure bool
	SessionTTL   time.Duration
}

// Handlers exposes the HTTP handlers backed by a service. Owner-scoped
// handlers resolve the authenticated actor from the request context (set by
// the Session middleware) instead of a fixed owner id.
type Handlers struct {
	svc Service
	cfg Config
}

// New constructs the handler set.
func New(svc Service, cfg Config) *Handlers {
	return &Handlers{svc: svc, cfg: cfg}
}

// actorOrUnauthorized returns the authenticated actor or writes a 401 and
// returns nil. Owner handlers run behind RequireAuth, so the actor is normally
// present; the guard keeps them safe if the chain changes.
func (h *Handlers) actorOrUnauthorized(w http.ResponseWriter, r *http.Request) *store.Actor {
	actor := middleware.ActorFromContext(r.Context())
	if actor == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "authentication required", "")
	}
	return actor
}
