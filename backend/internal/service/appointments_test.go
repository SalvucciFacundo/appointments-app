package service

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/salvuccifacundo/appointments-app/backend/internal/store"
)

// manualInput builds a valid manual-create payload for the single Monday
// 09:00-10:00 slot installed by newTestStore.
func manualInput(i int) CreateAppointmentInput {
	return CreateAppointmentInput{
		Date:        testDate,
		Time:        "09:00",
		ClientName:  fmt.Sprintf("Client %d", i),
		ClientPhone: fmt.Sprintf("555-00%02d", i),
		ClientEmail: fmt.Sprintf("client%d@example.com", i),
	}
}

func TestCreateAppointment_ValidatesAvailabilityUnlessForce(t *testing.T) {
	pool := testPool(t)
	ctx := context.Background()
	db := store.New(pool)
	svc := NewService(db)
	st := newTestStore(t, ctx, db)

	// Fill the only 09:00-10:00 slot through the public booking path.
	if _, err := svc.Book(ctx, st.Slug, bookingInput(1)); err != nil {
		t.Fatalf("Book: %v", err)
	}

	// Without force the occupied slot is rejected.
	_, err := svc.CreateAppointment(ctx, st.ID, manualInput(2))
	if !errors.Is(err, ErrSlotUnavailable) {
		t.Errorf("CreateAppointment(occupied slot) error = %v, want ErrSlotUnavailable", err)
	}

	// With force the owner override wins and the appointment is created.
	in := manualInput(2)
	in.Force = true
	appt, err := svc.CreateAppointment(ctx, st.ID, in)
	if err != nil {
		t.Fatalf("CreateAppointment(force): %v", err)
	}
	if appt.Status != store.StatusConfirmed {
		t.Errorf("status = %s, want CONFIRMED", appt.Status)
	}
}

func TestCreateAppointment_AvailableSlotPassesValidation(t *testing.T) {
	pool := testPool(t)
	ctx := context.Background()
	db := store.New(pool)
	svc := NewService(db)
	st := newTestStore(t, ctx, db)

	// Empty slot, no force → validation passes and the appointment is created.
	appt, err := svc.CreateAppointment(ctx, st.ID, manualInput(1))
	if err != nil {
		t.Fatalf("CreateAppointment: %v", err)
	}
	if appt.Status != store.StatusConfirmed {
		t.Errorf("status = %s, want CONFIRMED", appt.Status)
	}
}

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
