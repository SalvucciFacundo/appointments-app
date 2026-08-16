package handlers

import (
	"fmt"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/salvuccifacundo/appointments-app/backend/internal/service"
	"github.com/salvuccifacundo/appointments-app/backend/internal/store"
)

// UpdateHours handles PUT /api/stores/{id}/hours, replacing the full set of
// business hours for the store (transactional delete + create).
func (h *Handlers) UpdateHours(w http.ResponseWriter, r *http.Request) {
	var hours []store.BusinessHourInput
	if err := decodeJSON(r, &hours); err != nil {
		writeError(w, http.StatusBadRequest, "validation", "request body must be an array of business hours", "")
		return
	}
	for i, hh := range hours {
		prefix := fmt.Sprintf("[%d]", i)
		if err := service.ValidateDayOfWeek(hh.DayOfWeek); err != nil {
			writeError(w, http.StatusBadRequest, "validation", err.Error(), prefix+".dayOfWeek")
			return
		}
		if err := service.ValidateTimeFormat(hh.OpenTime, "openTime"); err != nil {
			writeError(w, http.StatusBadRequest, "validation", err.Error(), prefix+".openTime")
			return
		}
		if err := service.ValidateTimeFormat(hh.CloseTime, "closeTime"); err != nil {
			writeError(w, http.StatusBadRequest, "validation", err.Error(), prefix+".closeTime")
			return
		}
	}
	result, err := h.svc.ReplaceBusinessHours(r.Context(), chi.URLParam(r, "id"), hours)
	if err != nil {
		respondError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}
