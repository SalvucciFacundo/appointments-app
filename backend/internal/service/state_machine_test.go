package service

import (
	"errors"
	"testing"

	"github.com/salvuccifacundo/appointments-app/backend/internal/store"
)

func TestStateMachine_ValidTransitions(t *testing.T) {
	cases := []struct {
		name    string
		current store.AppointmentStatus
		action  string
		want    store.AppointmentStatus
	}{
		{"confirm pending", store.StatusPending, "CONFIRM", store.StatusConfirmed},
		{"reject pending", store.StatusPending, "REJECT", store.StatusCancelled},
		{"complete confirmed", store.StatusConfirmed, "COMPLETE", store.StatusCompleted},
		{"reject confirmed", store.StatusConfirmed, "REJECT", store.StatusCancelled},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := ValidateTransition(tc.current, tc.action)
			if err != nil {
				t.Fatalf("ValidateTransition(%s, %s) = %v, want nil", tc.current, tc.action, err)
			}
			if got != tc.want {
				t.Errorf("ValidateTransition(%s, %s) = %s, want %s", tc.current, tc.action, got, tc.want)
			}
		})
	}
}

func TestStateMachine_CaseInsensitive(t *testing.T) {
	cases := []struct {
		current store.AppointmentStatus
		action  string
		want    store.AppointmentStatus
	}{
		{store.StatusPending, "confirm", store.StatusConfirmed},
		{store.StatusPending, "Confirm", store.StatusConfirmed},
		{store.StatusPending, "cOnFiRm", store.StatusConfirmed},
		{store.StatusPending, "reject", store.StatusCancelled},
		{store.StatusPending, "REJECT", store.StatusCancelled},
		{store.StatusConfirmed, "complete", store.StatusCompleted},
	}
	for _, tc := range cases {
		got, err := ValidateTransition(tc.current, tc.action)
		if err != nil {
			t.Errorf("ValidateTransition(%s, %q) = %v, want nil", tc.current, tc.action, err)
			continue
		}
		if got != tc.want {
			t.Errorf("ValidateTransition(%s, %q) = %s, want %s", tc.current, tc.action, got, tc.want)
		}
	}
}

func TestStateMachine_TerminalStates(t *testing.T) {
	for _, current := range []store.AppointmentStatus{store.StatusCancelled, store.StatusCompleted} {
		for _, action := range []string{"CONFIRM", "REJECT", "COMPLETE"} {
			_, err := ValidateTransition(current, action)
			if err == nil {
				t.Errorf("ValidateTransition(%s, %s) = nil, want error", current, action)
				continue
			}
			assertFieldError(t, err, "action")
		}
	}
}

func TestStateMachine_InvalidAction(t *testing.T) {
	for _, action := range []string{"", "NOPE", "DELETE"} {
		_, err := ValidateTransition(store.StatusPending, action)
		if err == nil {
			t.Errorf("ValidateTransition(PENDING, %q) = nil, want error", action)
			continue
		}
		assertFieldError(t, err, "action")
	}
}

func TestStateMachine_InvalidTransition(t *testing.T) {
	// PENDING → COMPLETED requires CONFIRM first.
	_, err := ValidateTransition(store.StatusPending, "COMPLETE")
	if err == nil {
		t.Fatal("ValidateTransition(PENDING, COMPLETE) = nil, want error")
	}
	assertFieldError(t, err, "action")
}

func TestStateMachine_FieldErrorCarriesAction(t *testing.T) {
	_, err := ValidateTransition(store.StatusCompleted, "CONFIRM")
	assertFieldError(t, err, "action")
}

// assertFieldError asserts err is a *FieldError with the given field name.
func assertFieldError(t *testing.T, err error, field string) {
	t.Helper()
	var fe *FieldError
	if !errors.As(err, &fe) {
		t.Fatalf("error = %T (%v), want *FieldError", err, err)
	}
	if fe.Field != field {
		t.Errorf("FieldError.Field = %q, want %q", fe.Field, field)
	}
}
