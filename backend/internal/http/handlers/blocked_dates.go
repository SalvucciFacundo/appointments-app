package handlers

import (
	"net/http"

	"github.com/go-chi/chi/v5"
)

// blockedDateBody is the blocked-date create payload.
type blockedDateBody struct {
	Date   string  `json:"date"`
	Reason *string `json:"reason"`
}

// CreateBlockedDate handles POST /api/stores/{id}/blocked-dates. Only future
// dates are accepted (validated by the service).
func (h *Handlers) CreateBlockedDate(w http.ResponseWriter, r *http.Request) {
	var body blockedDateBody
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "validation", "invalid JSON body", "")
		return
	}
	if body.Date == "" {
		writeError(w, http.StatusBadRequest, "validation", "date is required", "date")
		return
	}
	actor := h.actorOrUnauthorized(w, r)
	if actor == nil {
		return
	}
	reason := ""
	if body.Reason != nil {
		reason = *body.Reason
	}
	bd, err := h.svc.CreateBlockedDate(r.Context(), actor.ID, chi.URLParam(r, "id"), body.Date, reason)
	if err != nil {
		respondError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, bd)
}

// DeleteBlockedDate handles DELETE /api/stores/{id}/blocked-dates/{bid}.
func (h *Handlers) DeleteBlockedDate(w http.ResponseWriter, r *http.Request) {
	actor := h.actorOrUnauthorized(w, r)
	if actor == nil {
		return
	}
	storeID := chi.URLParam(r, "id")
	bid := chi.URLParam(r, "bid")
	if err := h.svc.DeleteBlockedDate(r.Context(), actor.ID, storeID, bid); err != nil {
		respondError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
