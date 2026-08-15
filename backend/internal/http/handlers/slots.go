package handlers

import (
	"net/http"

	"github.com/go-chi/chi/v5"
)

// GetSlots handles GET /api/stores/{slug}/slots?date=YYYY-MM-DD.
func (h *Handlers) GetSlots(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	date := r.URL.Query().Get("date")
	if date == "" {
		writeError(w, http.StatusBadRequest, "validation", "date query parameter is required", "date")
		return
	}
	slots, err := h.svc.GetSlots(r.Context(), slug, date)
	if err != nil {
		respondError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, slots)
}
