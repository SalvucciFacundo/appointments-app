package service

import "github.com/salvuccifacundo/appointments-app/backend/internal/store"

// Service orchestrates business logic over the store data access layer. Pure
// helpers (AvailableSlots, ValidateTransition, validators) remain standalone
// functions; Service wires them to the database.
type Service struct {
	db *store.DB
}

// NewService constructs a Service backed by the given store.
func NewService(db *store.DB) *Service {
	return &Service{db: db}
}
