package handlers

import (
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/salvuccifacundo/appointments-app/backend/internal/service"
	"github.com/salvuccifacundo/appointments-app/backend/internal/store"
)

// ListAppointments handles GET /api/stores/{id}/appointments with optional
// date and status filters.
func (h *Handlers) ListAppointments(w http.ResponseWriter, r *http.Request) {
	actor := h.actorOrUnauthorized(w, r)
	if actor == nil {
		return
	}
	storeID := chi.URLParam(r, "id")
	date := r.URL.Query().Get("date")
	var status *store.AppointmentStatus
	if s := strings.TrimSpace(r.URL.Query().Get("status")); s != "" {
		st := store.AppointmentStatus(s)
		status = &st
	}
	appointments, err := h.svc.ListAppointments(r.Context(), actor.ID, storeID, date, status)
	if err != nil {
		respondError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, appointments)
}

// createAppointmentBody is the owner manual-create payload. Status defaults
// to CONFIRMED when omitted; force skips the availability validation (explicit
// owner override).
type createAppointmentBody struct {
	Date        string `json:"date"`
	Time        string `json:"time"`
	ClientName  string `json:"clientName"`
	ClientPhone string `json:"clientPhone"`
	ClientEmail string `json:"clientEmail"`
	Service     string `json:"service,omitempty"`
	Notes       string `json:"notes,omitempty"`
	Status      string `json:"status,omitempty"`
	Force       bool   `json:"force,omitempty"`
}

// CreateAppointment handles POST /api/stores/{id}/appointments (owner manual
// creation).
func (h *Handlers) CreateAppointment(w http.ResponseWriter, r *http.Request) {
	var body createAppointmentBody
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "validation", "invalid JSON body", "")
		return
	}
	actor := h.actorOrUnauthorized(w, r)
	if actor == nil {
		return
	}
	in := service.CreateAppointmentInput{
		Date:        body.Date,
		Time:        body.Time,
		ClientName:  body.ClientName,
		ClientPhone: body.ClientPhone,
		ClientEmail: body.ClientEmail,
		Service:     body.Service,
		Notes:       body.Notes,
		Status:      store.AppointmentStatus(body.Status),
		Force:       body.Force,
	}
	appt, err := h.svc.CreateAppointment(r.Context(), actor.ID, chi.URLParam(r, "id"), in)
	if err != nil {
		respondError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, appt)
}

// actionBody carries the state-machine action for an appointment.
type actionBody struct {
	Action string `json:"action"`
}

// UpdateAppointmentStatus handles PUT /api/stores/{id}/appointments/{aid}
// with {action: CONFIRM|REJECT|COMPLETE}.
func (h *Handlers) UpdateAppointmentStatus(w http.ResponseWriter, r *http.Request) {
	var body actionBody
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "validation", "invalid JSON body", "")
		return
	}
	actor := h.actorOrUnauthorized(w, r)
	if actor == nil {
		return
	}
	appt, err := h.svc.UpdateAppointmentStatus(
		r.Context(), actor.ID, chi.URLParam(r, "id"), chi.URLParam(r, "aid"), body.Action)
	if err != nil {
		respondError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, appt)
}

// rescheduleBody carries the new {date, time} for a reschedule.
type rescheduleBody struct {
	Date string `json:"date"`
	Time string `json:"time"`
}

// RescheduleAppointment handles PUT /api/stores/{id}/appointments/{aid}/reschedule
// with {date, time}, revalidating availability while excluding the appointment
// itself from capacity.
func (h *Handlers) RescheduleAppointment(w http.ResponseWriter, r *http.Request) {
	var body rescheduleBody
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "validation", "invalid JSON body", "")
		return
	}
	actor := h.actorOrUnauthorized(w, r)
	if actor == nil {
		return
	}
	appt, err := h.svc.RescheduleAppointment(
		r.Context(), actor.ID, chi.URLParam(r, "id"), chi.URLParam(r, "aid"), body.Date, body.Time)
	if err != nil {
		respondError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, appt)
}
