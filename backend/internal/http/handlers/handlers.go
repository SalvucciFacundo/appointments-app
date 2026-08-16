// Package handlers contains the thin HTTP layer: each handler parses the
// request, calls the service, and writes the response. Business logic lives
// in the service package; handlers never touch the database.
package handlers

import (
	"context"

	"github.com/salvuccifacundo/appointments-app/backend/internal/service"
	"github.com/salvuccifacundo/appointments-app/backend/internal/store"
)

// Service is the slice of the business layer the handlers consume. It is
// defined here (consumer side) so handlers can be tested against a fake
// without a database.
type Service interface {
	ListPublicStores(ctx context.Context, q, specialty string, page, limit int) ([]store.Store, int, error)
	GetPublicStore(ctx context.Context, slug string) (store.Store, []store.BusinessHour, error)
	GetSlots(ctx context.Context, slug, date string) ([]service.TimeSlot, error)
	Book(ctx context.Context, slug string, in service.BookInput) (*store.Appointment, error)

	ListStoresByOwner(ctx context.Context, ownerID string) ([]store.StoreDetail, error)
	CreateStore(ctx context.Context, ownerID string, in store.CreateStoreInput) (store.Store, error)
	GetStore(ctx context.Context, id string) (store.StoreDetail, error)
	UpdateStore(ctx context.Context, id string, in store.UpdateStoreInput) (store.Store, error)

	ReplaceBusinessHours(ctx context.Context, storeID string, in []store.BusinessHourInput) ([]store.BusinessHour, error)
	CreateBlockedDate(ctx context.Context, storeID, date, reason string) (store.BlockedDate, error)
	DeleteBlockedDate(ctx context.Context, storeID, id string) error

	ListAppointments(ctx context.Context, storeID, date string, status *store.AppointmentStatus) ([]store.Appointment, error)
	CreateAppointment(ctx context.Context, storeID string, in service.CreateAppointmentInput) (store.Appointment, error)
	UpdateAppointmentStatus(ctx context.Context, storeID, apptID, action string) (store.Appointment, error)
	RescheduleAppointment(ctx context.Context, storeID, apptID, date, time string) (store.Appointment, error)
}

// Handlers exposes the HTTP handlers backed by a service and the owner id
// used for owner-scoped operations (single-owner API-key stub).
type Handlers struct {
	svc     Service
	ownerID string
}

// New constructs the handler set.
func New(svc Service, ownerID string) *Handlers {
	return &Handlers{svc: svc, ownerID: ownerID}
}
