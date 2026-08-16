package handlers_test

import (
	"context"
	"net/http"
	"testing"

	"github.com/salvuccifacundo/appointments-app/backend/internal/service"
	"github.com/salvuccifacundo/appointments-app/backend/internal/store"
)

func TestCreateAppointment_DefaultValidates(t *testing.T) {
	f := &fakeService{}
	f.createAppointment = func(_ context.Context, storeID string, in service.CreateAppointmentInput) (store.Appointment, error) {
		if storeID != "s1" {
			t.Errorf("storeID = %q, want s1", storeID)
		}
		if in.Force {
			t.Errorf("force = true, want false (default validates)")
		}
		return store.Appointment{}, service.ErrSlotUnavailable
	}
	h := newTestRouter(t, f)
	body := `{"date":"2027-01-04","time":"09:00","clientName":"Ana","clientPhone":"555-0100","clientEmail":"ana@example.com"}`
	rr := doRequest(t, h, http.MethodPost, "/api/stores/s1/appointments", body)
	status, code, _, _ := errContract(t, rr)
	if status != http.StatusConflict || code != "slot_unavailable" {
		t.Errorf("got (%d, %q), want (409, slot_unavailable)", status, code)
	}
}

func TestCreateAppointment_ForceForwarded(t *testing.T) {
	f := &fakeService{}
	var gotForce bool
	f.createAppointment = func(_ context.Context, storeID string, in service.CreateAppointmentInput) (store.Appointment, error) {
		gotForce = in.Force
		return store.Appointment{ID: "a1", Status: store.StatusConfirmed}, nil
	}
	h := newTestRouter(t, f)
	body := `{"date":"2027-01-04","time":"09:00","clientName":"Ana","clientPhone":"555-0100","clientEmail":"ana@example.com","force":true}`
	rr := doRequest(t, h, http.MethodPost, "/api/stores/s1/appointments", body)
	if rr.Code != http.StatusCreated {
		t.Fatalf("status %d, want 201", rr.Code)
	}
	if !gotForce {
		t.Errorf("force = false, want true (forwarded from body)")
	}
}
