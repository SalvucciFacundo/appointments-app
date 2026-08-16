package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"
	_ "time/tzdata" // embed tzdata so LoadLocation works on distroless images

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/salvuccifacundo/appointments-app/backend/internal/store"
)

// BookInput is the public booking request body. Date/Time are interpreted in
// the store's timezone (server is the source of truth).
type BookInput struct {
	Date        string `json:"date"` // YYYY-MM-DD
	Time        string `json:"time"` // HH:MM
	ClientName  string `json:"clientName"`
	ClientPhone string `json:"clientPhone"`
	ClientEmail string `json:"clientEmail"`
	Service     string `json:"service,omitempty"`
	Notes       string `json:"notes,omitempty"`
}

// Book creates a PENDING appointment (with a management token) for an
// available slot. It serializes concurrent bookings for the same store with
// SELECT ... FOR UPDATE on the store row, then revalidates availability and
// inserts atomically. A slot at capacity returns ErrSlotUnavailable (409).
func (s *Service) Book(ctx context.Context, slug string, in BookInput) (*store.Appointment, error) {
	if err := validateBookInput(in); err != nil {
		return nil, err
	}
	d, _ := time.Parse("2006-01-02", in.Date) // format already validated
	tm, _ := time.Parse("15:04", in.Time)     // format already validated

	tx, err := s.db.Pool().Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck // no-op after commit

	// Lock the store row: concurrent bookings for the same store serialize
	// here; each later transaction re-reads a fresh snapshot on acquire.
	locked, err := store.LockStoreBySlugForUpdate(ctx, tx, slug)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	loc, err := loadLocation(locked.Timezone)
	if err != nil {
		return nil, err
	}
	dateTime := time.Date(d.Year(), d.Month(), d.Day(), tm.Hour(), tm.Minute(), 0, 0, loc).UTC()

	hours, err := store.ListBusinessHoursTx(ctx, tx, locked.ID)
	if err != nil {
		return nil, err
	}
	blocked, err := store.ListBlockedDatesTx(ctx, tx, locked.ID)
	if err != nil {
		return nil, err
	}
	startUTC, endUTC := localDayWindow(loc, d)
	existing, err := store.AppointmentsInWindowTx(ctx, tx, locked.ID, startUTC, endUTC)
	if err != nil {
		return nil, err
	}

	slotInput := SlotStoreInput{
		Timezone:            locked.Timezone,
		SlotDuration:        locked.SlotDuration,
		MaxParallelBookings: locked.MaxParallelBookings,
		MaxSlotsPerDay:      locked.MaxSlotsPerDay,
		BusinessHours:       hours,
		BlockedDates:        blocked,
	}
	available, err := slotIsAvailable(slotInput, in.Date, in.Time, existing)
	if err != nil {
		return nil, err
	}
	if !available {
		return nil, ErrSlotUnavailable
	}

	var servicePtr, notesPtr *string
	if in.Service != "" {
		servicePtr = &in.Service
	}
	if in.Notes != "" {
		notesPtr = &in.Notes
	}
	token := uuid.NewString()

	appt, err := store.CreateAppointmentTx(ctx, tx, store.CreateAppointmentInput{
		StoreID:         locked.ID,
		ClientName:      in.ClientName,
		ClientPhone:     in.ClientPhone,
		ClientEmail:     in.ClientEmail,
		DateTime:        dateTime,
		Service:         servicePtr,
		Status:          store.StatusPending,
		Notes:           notesPtr,
		ManagementToken: &token,
	})
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &appt, nil
}

// validateBookInput checks required fields and date/time formats, returning a
// *FieldError with the offending field name.
func validateBookInput(in BookInput) error {
	if strings.TrimSpace(in.ClientName) == "" {
		return &FieldError{Field: "clientName", Message: "clientName is required"}
	}
	if strings.TrimSpace(in.ClientPhone) == "" {
		return &FieldError{Field: "clientPhone", Message: "clientPhone is required"}
	}
	if strings.TrimSpace(in.ClientEmail) == "" {
		return &FieldError{Field: "clientEmail", Message: "clientEmail is required"}
	}
	if err := ValidateTimeFormat(in.Time, "time"); err != nil {
		return &FieldError{Field: "time", Message: err.Error()}
	}
	if _, err := time.Parse("2006-01-02", in.Date); err != nil {
		return &FieldError{Field: "date", Message: "date must be in YYYY-MM-DD format"}
	}
	return nil
}

// loadLocation resolves the store timezone, defaulting to UTC.
func loadLocation(tz string) (*time.Location, error) {
	if tz == "" {
		tz = "UTC"
	}
	loc, err := time.LoadLocation(tz)
	if err != nil {
		return nil, fmt.Errorf("invalid timezone %q: %w", tz, err)
	}
	return loc, nil
}

// slotIsAvailable reports whether the slot starting at `time` on `date` is
// bookable given the existing appointments, reusing the same availability
// rules as AvailableSlots. A time that is not a valid slot boundary is
// reported as unavailable.
func slotIsAvailable(s SlotStoreInput, date, time string, existing []store.Appointment) (bool, error) {
	slots, err := AvailableSlots(s, date, existing)
	if err != nil {
		return false, err
	}
	for _, sl := range slots {
		if sl.Start == time {
			return sl.Available, nil
		}
	}
	return false, nil
}
