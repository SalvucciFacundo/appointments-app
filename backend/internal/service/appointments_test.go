package service

import (
	"context"
	"errors"
	"testing"

	"github.com/salvuccifacundo/appointments-app/backend/internal/store"
)

func TestCreateBlockedDate_PastDateRejected(t *testing.T) {
	// Validation runs before any DB access, so a nil-backed service suffices.
	svc := NewService(store.New(nil))
	_, err := svc.CreateBlockedDate(context.Background(), "s1", "2020-01-01", "")
	var fe *FieldError
	if !errors.As(err, &fe) || fe.Field != "date" {
		t.Errorf("error = %v, want FieldError{field=date}", err)
	}
}

func TestCreateBlockedDate_BadFormatRejected(t *testing.T) {
	svc := NewService(store.New(nil))
	_, err := svc.CreateBlockedDate(context.Background(), "s1", "01-01-2020", "")
	var fe *FieldError
	if !errors.As(err, &fe) || fe.Field != "date" {
		t.Errorf("error = %v, want FieldError{field=date}", err)
	}
}

func TestReschedule_HappyPathExcludesSelf(t *testing.T) {
	pool := testPool(t)
	ctx := context.Background()
	db := store.New(pool)
	svc := NewService(db)
	st := newTestStore(t, ctx, db)

	// The single 09:00-10:00 slot is now full.
	appt, err := svc.Book(ctx, st.Slug, bookingInput(1))
	if err != nil {
		t.Fatalf("Book: %v", err)
	}

	// Rescheduling onto its own slot must succeed because the appointment is
	// excluded from its own capacity count.
	updated, err := svc.RescheduleAppointment(ctx, st.ID, appt.ID, testDate, "09:00")
	if err != nil {
		t.Fatalf("RescheduleAppointment onto own slot: %v", err)
	}
	if !updated.DateTime.Equal(appt.DateTime) {
		t.Errorf("dateTime = %v, want %v", updated.DateTime, appt.DateTime)
	}
}

func TestReschedule_UnavailableSlot(t *testing.T) {
	pool := testPool(t)
	ctx := context.Background()
	db := store.New(pool)
	svc := NewService(db)
	st := newTestStore(t, ctx, db)

	appt, err := svc.Book(ctx, st.Slug, bookingInput(1))
	if err != nil {
		t.Fatalf("Book: %v", err)
	}

	// 11:00 is outside the 09:00-10:00 window → slot unavailable.
	_, err = svc.RescheduleAppointment(ctx, st.ID, appt.ID, testDate, "11:00")
	var fe *FieldError
	if !errors.As(err, &fe) || fe.Field != "time" {
		t.Errorf("error = %v, want FieldError{field=time}", err)
	}
}

func TestReschedule_CrossStoreNotFound(t *testing.T) {
	pool := testPool(t)
	ctx := context.Background()
	db := store.New(pool)
	svc := NewService(db)
	stA := newTestStore(t, ctx, db)
	stB := newTestStore(t, ctx, db)

	appt, err := svc.Book(ctx, stA.Slug, bookingInput(1))
	if err != nil {
		t.Fatalf("Book: %v", err)
	}

	// Rescheduling stA's appointment through stB must be treated as missing.
	_, err = svc.RescheduleAppointment(ctx, stB.ID, appt.ID, testDate, "09:00")
	if !errors.Is(err, ErrNotFound) {
		t.Errorf("error = %v, want ErrNotFound", err)
	}
}

func TestUpdateStatus_CrossStoreNotFound(t *testing.T) {
	pool := testPool(t)
	ctx := context.Background()
	db := store.New(pool)
	svc := NewService(db)
	stA := newTestStore(t, ctx, db)
	stB := newTestStore(t, ctx, db)

	appt, err := svc.Book(ctx, stA.Slug, bookingInput(1))
	if err != nil {
		t.Fatalf("Book: %v", err)
	}

	_, err = svc.UpdateAppointmentStatus(ctx, stB.ID, appt.ID, "CONFIRM")
	if !errors.Is(err, ErrNotFound) {
		t.Errorf("error = %v, want ErrNotFound", err)
	}
}
