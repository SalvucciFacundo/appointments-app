package service

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/salvuccifacundo/appointments-app/backend/internal/store"
)

// Store field defaults applied when creating a store, matching the DB schema
// defaults (the create payload only carries the user-editable fields).
const (
	defaultTimezone            = "America/Argentina/Buenos_Aires"
	defaultSlotDuration        = 60
	defaultMaxParallelBookings = 1
	defaultMaxSlotsPerDay      = 0
	defaultCancelationLimit    = 2
)

// ListPublicStores returns a page of public stores matching the free-text q
// and specialty filters.
func (s *Service) ListPublicStores(ctx context.Context, q, specialty string, page, limit int) ([]store.Store, int, error) {
	return s.db.ListPublicStores(ctx, q, specialty, limit, (page-1)*limit)
}

// GetPublicStore returns a store by slug together with its business hours.
func (s *Service) GetPublicStore(ctx context.Context, slug string) (store.Store, []store.BusinessHour, error) {
	st, err := s.db.GetStoreBySlug(ctx, slug)
	if err != nil {
		return store.Store{}, nil, notFoundIfNoRows(err)
	}
	hours, err := s.db.ListBusinessHours(ctx, st.ID)
	if err != nil {
		return store.Store{}, nil, err
	}
	return st, hours, nil
}

// requireStoreOwnership loads a store and verifies the authenticated actor
// owns it. Missing stores map to ErrNotFound, foreign stores to ErrForbidden.
func (s *Service) requireStoreOwnership(ctx context.Context, actorID, storeID string) (store.Store, error) {
	st, err := s.db.GetStoreByID(ctx, storeID)
	if err != nil {
		return store.Store{}, notFoundIfNoRows(err)
	}
	if st.OwnerID != actorID {
		return store.Store{}, ErrForbidden
	}
	return st, nil
}

// ListStoresByOwner returns all stores owned by the authenticated actor with
// their business hours and blocked dates embedded. The owner has few stores,
// so per-store lookups are acceptable here.
func (s *Service) ListStoresByOwner(ctx context.Context, actorID string) ([]store.StoreDetail, error) {
	stores, err := s.db.ListStoresByOwner(ctx, actorID)
	if err != nil {
		return nil, err
	}
	out := make([]store.StoreDetail, 0, len(stores))
	for _, st := range stores {
		hours, err := s.db.ListBusinessHours(ctx, st.ID)
		if err != nil {
			return nil, err
		}
		blocked, err := s.db.ListBlockedDates(ctx, st.ID)
		if err != nil {
			return nil, err
		}
		out = append(out, store.StoreDetail{Store: st, BusinessHours: hours, BlockedDates: blocked})
	}
	return out, nil
}

// CreateStore validates the input, ensures the owner user row exists, resolves
// a unique slug, and inserts the store.
func (s *Service) CreateStore(ctx context.Context, actorID string, in store.CreateStoreInput) (store.Store, error) {
	if strings.TrimSpace(in.Name) == "" {
		return store.Store{}, &FieldError{Field: "name", Message: "name is required"}
	}
	if strings.TrimSpace(in.Address) == "" {
		return store.Store{}, &FieldError{Field: "address", Message: "address is required"}
	}
	if strings.TrimSpace(in.Specialty) == "" {
		return store.Store{}, &FieldError{Field: "specialty", Message: "specialty is required"}
	}

	if in.Timezone == "" {
		in.Timezone = defaultTimezone
	}
	if in.SlotDuration == 0 {
		in.SlotDuration = defaultSlotDuration
	}
	if in.MaxParallelBookings == 0 {
		in.MaxParallelBookings = defaultMaxParallelBookings
	}
	if in.MaxSlotsPerDay == 0 {
		in.MaxSlotsPerDay = defaultMaxSlotsPerDay
	}
	if in.CancelationLimit == 0 {
		in.CancelationLimit = defaultCancelationLimit
	}

	if err := s.db.EnsureOwnerUser(ctx, actorID); err != nil {
		return store.Store{}, err
	}
	slug, err := GenerateUniqueSlug(ctx, s.db, in.Name)
	if err != nil {
		return store.Store{}, err
	}
	in.Slug = slug
	in.OwnerID = actorID
	return s.db.CreateStore(ctx, in)
}

// GetStore returns a store by id with its business hours and blocked dates.
func (s *Service) GetStore(ctx context.Context, actorID, id string) (store.StoreDetail, error) {
	st, err := s.requireStoreOwnership(ctx, actorID, id)
	if err != nil {
		return store.StoreDetail{}, err
	}
	hours, err := s.db.ListBusinessHours(ctx, id)
	if err != nil {
		return store.StoreDetail{}, err
	}
	blocked, err := s.db.ListBlockedDates(ctx, id)
	if err != nil {
		return store.StoreDetail{}, err
	}
	return store.StoreDetail{Store: st, BusinessHours: hours, BlockedDates: blocked}, nil
}

// UpdateStore applies a partial update to the store with the given id.
func (s *Service) UpdateStore(ctx context.Context, actorID, id string, in store.UpdateStoreInput) (store.Store, error) {
	if _, err := s.requireStoreOwnership(ctx, actorID, id); err != nil {
		return store.Store{}, err
	}
	return s.db.UpdateStore(ctx, id, in)
}

// ReplaceBusinessHours atomically replaces all business hours for a store.
func (s *Service) ReplaceBusinessHours(ctx context.Context, actorID, storeID string, in []store.BusinessHourInput) ([]store.BusinessHour, error) {
	if _, err := s.requireStoreOwnership(ctx, actorID, storeID); err != nil {
		return nil, err
	}
	return s.db.ReplaceBusinessHours(ctx, storeID, in)
}

// CreateBlockedDate validates that the date is not in the past, then blocks it.
func (s *Service) CreateBlockedDate(ctx context.Context, actorID, storeID, date, reason string) (store.BlockedDate, error) {
	if err := ValidateFutureDate(date); err != nil {
		return store.BlockedDate{}, &FieldError{Field: "date", Message: err.Error()}
	}
	d, err := time.Parse("2006-01-02", date)
	if err != nil {
		return store.BlockedDate{}, &FieldError{Field: "date", Message: "date must be in YYYY-MM-DD format"}
	}
	if _, err := s.requireStoreOwnership(ctx, actorID, storeID); err != nil {
		return store.BlockedDate{}, err
	}
	var reasonPtr *string
	if reason = strings.TrimSpace(reason); reason != "" {
		reasonPtr = &reason
	}
	return s.db.CreateBlockedDate(ctx, storeID, store.Date(d), reasonPtr)
}

// DeleteBlockedDate removes a blocked date. It is idempotent: deleting a
// non-existent date still succeeds once the store exists.
func (s *Service) DeleteBlockedDate(ctx context.Context, actorID, storeID, id string) error {
	if _, err := s.requireStoreOwnership(ctx, actorID, storeID); err != nil {
		return err
	}
	if err := s.db.DeleteBlockedDate(ctx, id); err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return err
	}
	return nil
}
