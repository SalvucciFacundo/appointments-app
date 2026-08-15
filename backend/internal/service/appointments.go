package service

import (
	"context"
	"strings"
	"time"

	"github.com/salvuccifacundo/appointments-app/backend/internal/store"
)

// CreateAppointmentInput is the owner payload for manually creating an
// appointment. Date/Time are interpreted in the store's timezone; an empty
// Status defaults to CONFIRMED. Availability is validated unless Force is set
// (explicit owner override, mirroring the original owner portal behavior).
type CreateAppointmentInput struct {
	Date        string
	Time        string
	ClientName  string
	ClientPhone string
	ClientEmail string
	Service     string
	Notes       string
	Status      store.AppointmentStatus
	Force       bool
}

// ListAppointments returns a store's appointments, optionally filtered by
// local date (interpreted in the store's timezone) and status.
func (s *Service) ListAppointments(ctx context.Context, storeID, date string, status *store.AppointmentStatus) ([]store.Appointment, error) {
	st, err := s.db.GetStoreByID(ctx, storeID)
	if err != nil {
		return nil, notFoundIfNoRows(err)
	}

	f := store.AppointmentFilter{}
	if date != "" {
		d, err := time.Parse("2006-01-02", date)
		if err != nil {
			return nil, &FieldError{Field: "date", Message: "date must be in YYYY-MM-DD format"}
		}
		loc, err := loadLocation(st.Timezone)
		if err != nil {
			return nil, err
		}
		start, end := localDayWindow(loc, d)
		f.Start, f.End = &start, &end
	}
	if status != nil {
		switch *status {
		case store.StatusPending, store.StatusConfirmed, store.StatusCancelled, store.StatusCompleted:
			f.Status = status
		default:
			return nil, &FieldError{Field: "status", Message: "status must be one of PENDING, CONFIRMED, CANCELLED, COMPLETED"}
		}
	}
	return s.db.ListAppointments(ctx, storeID, f)
}

// CreateAppointment manually creates an appointment (status defaults to
// CONFIRMED). Availability is validated against business hours, blocked dates,
// and capacity unless the owner explicitly overrides with Force, in which case
// the appointment is created regardless (409 otherwise via ErrSlotUnavailable).
func (s *Service) CreateAppointment(ctx context.Context, storeID string, in CreateAppointmentInput) (store.Appointment, error) {
	if err := validateManualCreateInput(in); err != nil {
		return store.Appointment{}, err
	}
	st, err := s.db.GetStoreByID(ctx, storeID)
	if err != nil {
		return store.Appointment{}, notFoundIfNoRows(err)
	}
	d, _ := time.Parse("2006-01-02", in.Date)
	tm, _ := time.Parse("15:04", in.Time)
	loc, err := loadLocation(st.Timezone)
	if err != nil {
		return store.Appointment{}, err
	}
	dateTime := time.Date(d.Year(), d.Month(), d.Day(), tm.Hour(), tm.Minute(), 0, 0, loc).UTC()

	if !in.Force {
		hours, err := s.db.ListBusinessHours(ctx, storeID)
		if err != nil {
			return store.Appointment{}, err
		}
		blocked, err := s.db.ListBlockedDates(ctx, storeID)
		if err != nil {
			return store.Appointment{}, err
		}
		start, end := localDayWindow(loc, d)
		existing, err := s.db.AppointmentsInWindow(ctx, storeID, start, end)
		if err != nil {
			return store.Appointment{}, err
		}
		available, err := slotIsAvailable(SlotStoreInput{
			Timezone:            st.Timezone,
			SlotDuration:        st.SlotDuration,
			MaxParallelBookings: st.MaxParallelBookings,
			MaxSlotsPerDay:      st.MaxSlotsPerDay,
			BusinessHours:       hours,
			BlockedDates:        blocked,
		}, in.Date, in.Time, existing)
		if err != nil {
			return store.Appointment{}, err
		}
		if !available {
			return store.Appointment{}, ErrSlotUnavailable
		}
	}

	status := in.Status
	if status == "" {
		status = store.StatusConfirmed
	}
	var servicePtr, notesPtr *string
	if in.Service != "" {
		servicePtr = &in.Service
	}
	if in.Notes != "" {
		notesPtr = &in.Notes
	}
	return s.db.CreateAppointment(ctx, store.CreateAppointmentInput{
		StoreID:         storeID,
		ClientName:      in.ClientName,
		ClientPhone:     in.ClientPhone,
		ClientEmail:     in.ClientEmail,
		DateTime:        dateTime,
		Service:         servicePtr,
		Status:          status,
		Notes:           notesPtr,
		ManagementToken: nil,
	})
}

// UpdateAppointmentStatus applies a state-machine action (CONFIRM, REJECT,
// COMPLETE) to an appointment, returning 404 when it belongs to another store.
func (s *Service) UpdateAppointmentStatus(ctx context.Context, storeID, apptID, action string) (store.Appointment, error) {
	if strings.TrimSpace(action) == "" {
		return store.Appointment{}, &FieldError{Field: "action", Message: "action is required (CONFIRM, REJECT, or COMPLETE)"}
	}
	appt, err := s.db.GetAppointmentByID(ctx, apptID)
	if err != nil {
		return store.Appointment{}, notFoundIfNoRows(err)
	}
	if appt.StoreID != storeID {
		return store.Appointment{}, ErrNotFound
	}
	target, err := ValidateTransition(appt.Status, action)
	if err != nil {
		return store.Appointment{}, err
	}
	return s.db.UpdateAppointmentStatus(ctx, apptID, target)
}

// RescheduleAppointment moves an appointment to a new {date, time} in the
// store's timezone, revalidating availability while excluding the appointment
// itself from the capacity count.
func (s *Service) RescheduleAppointment(ctx context.Context, storeID, apptID, date, at string) (store.Appointment, error) {
	if err := ValidateTimeFormat(at, "time"); err != nil {
		return store.Appointment{}, &FieldError{Field: "time", Message: err.Error()}
	}
	if _, err := time.Parse("2006-01-02", date); err != nil {
		return store.Appointment{}, &FieldError{Field: "date", Message: "date must be in YYYY-MM-DD format"}
	}

	st, err := s.db.GetStoreByID(ctx, storeID)
	if err != nil {
		return store.Appointment{}, notFoundIfNoRows(err)
	}
	appt, err := s.db.GetAppointmentByID(ctx, apptID)
	if err != nil {
		return store.Appointment{}, notFoundIfNoRows(err)
	}
	if appt.StoreID != storeID {
		return store.Appointment{}, ErrNotFound
	}

	loc, err := loadLocation(st.Timezone)
	if err != nil {
		return store.Appointment{}, err
	}
	d, _ := time.Parse("2006-01-02", date)
	tm, _ := time.Parse("15:04", at)

	hours, err := s.db.ListBusinessHours(ctx, storeID)
	if err != nil {
		return store.Appointment{}, err
	}
	blocked, err := s.db.ListBlockedDates(ctx, storeID)
	if err != nil {
		return store.Appointment{}, err
	}
	start, end := localDayWindow(loc, d)
	existing, err := s.db.AppointmentsInWindowExcluding(ctx, storeID, start, end, apptID)
	if err != nil {
		return store.Appointment{}, err
	}

	slotInput := SlotStoreInput{
		Timezone:            st.Timezone,
		SlotDuration:        st.SlotDuration,
		MaxParallelBookings: st.MaxParallelBookings,
		MaxSlotsPerDay:      st.MaxSlotsPerDay,
		BusinessHours:       hours,
		BlockedDates:        blocked,
	}
	available, err := slotIsAvailable(slotInput, date, at, existing)
	if err != nil {
		return store.Appointment{}, err
	}
	if !available {
		return store.Appointment{}, &FieldError{Field: "time", Message: "slot is no longer available"}
	}

	dateTime := time.Date(d.Year(), d.Month(), d.Day(), tm.Hour(), tm.Minute(), 0, 0, loc).UTC()
	return s.db.RescheduleAppointment(ctx, apptID, dateTime)
}

// validateManualCreateInput checks required fields, date/time formats, and an
// optional status value.
func validateManualCreateInput(in CreateAppointmentInput) error {
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
	if in.Status != "" {
		switch in.Status {
		case store.StatusPending, store.StatusConfirmed, store.StatusCancelled, store.StatusCompleted:
		default:
			return &FieldError{Field: "status", Message: "status must be one of PENDING, CONFIRMED, CANCELLED, COMPLETED"}
		}
	}
	return nil
}
