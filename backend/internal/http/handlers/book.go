package handlers

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/salvuccifacundo/appointments-app/backend/internal/service"
)

// Book handles POST /api/stores/{slug}/book. A successful booking returns 201
// with a PENDING appointment carrying a management token.
func (h *Handlers) Book(w http.ResponseWriter, r *http.Request) {
	var in service.BookInput
	if err := decodeJSON(r, &in); err != nil {
		writeError(w, http.StatusBadRequest, "validation", "invalid JSON body", "")
		return
	}
	appt, err := h.svc.Book(r.Context(), chi.URLParam(r, "slug"), in)
	if err != nil {
		respondError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, appt)
}
