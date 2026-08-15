package handlers

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/salvuccifacundo/appointments-app/backend/internal/service"
	"github.com/salvuccifacundo/appointments-app/backend/internal/store"
)

// publicStore is the store card shown on the landing page. Reviews are out of
// scope, so ratings are always zero.
type publicStore struct {
	ID            string  `json:"id"`
	Name          string  `json:"name"`
	Slug          string  `json:"slug"`
	Specialty     string  `json:"specialty"`
	Address       string  `json:"address"`
	AverageRating float64 `json:"averageRating"`
	ReviewCount   int     `json:"reviewCount"`
}

// publicStoreDetail is the public store page payload: store info plus hours.
type publicStoreDetail struct {
	ID            string               `json:"id"`
	Name          string               `json:"name"`
	Slug          string               `json:"slug"`
	Description   *string              `json:"description"`
	Address       string               `json:"address"`
	Phone         *string              `json:"phone"`
	Specialty     string               `json:"specialty"`
	Timezone      string               `json:"timezone"`
	BusinessHours []store.BusinessHour `json:"businessHours"`
	AverageRating float64              `json:"averageRating"`
	ReviewCount   int                  `json:"reviewCount"`
}

// storeDetail is the owner view of a store including hours and blocked dates.
type storeDetail struct {
	store.Store
	BusinessHours []store.BusinessHour `json:"businessHours"`
	BlockedDates  []store.BlockedDate  `json:"blockedDates"`
}

// createStoreBody is the allowed create payload (slug is server-generated).
type createStoreBody struct {
	Name        string   `json:"name"`
	Description *string  `json:"description"`
	Address     string   `json:"address"`
	Phone       *string  `json:"phone"`
	Latitude    *float64 `json:"latitude"`
	Longitude   *float64 `json:"longitude"`
	Specialty   string   `json:"specialty"`
}

// updateStoreBody is the allowlist of updatable store fields.
type updateStoreBody struct {
	Name                *string  `json:"name"`
	Description         *string  `json:"description"`
	Address             *string  `json:"address"`
	Phone               *string  `json:"phone"`
	Latitude            *float64 `json:"latitude"`
	Longitude           *float64 `json:"longitude"`
	Specialty           *string  `json:"specialty"`
	SlotDuration        *int     `json:"slotDuration"`
	MaxParallelBookings *int     `json:"maxParallelBookings"`
	MaxSlotsPerDay      *int     `json:"maxSlotsPerDay"`
	CancelationLimit    *int     `json:"cancelationLimit"`
}

// ListPublicStores handles GET /api/stores/public with q, specialty, page,
// and limit query parameters.
func (h *Handlers) ListPublicStores(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	specialty := r.URL.Query().Get("specialty")
	p := service.ParsePagination(r.URL.Query().Get("page"), r.URL.Query().Get("limit"))

	stores, total, err := h.svc.ListPublicStores(r.Context(), q, specialty, p.Page, p.Limit)
	if err != nil {
		respondError(w, err)
		return
	}

	data := make([]publicStore, 0, len(stores))
	for _, st := range stores {
		data = append(data, publicStore{
			ID:        st.ID,
			Name:      st.Name,
			Slug:      st.Slug,
			Specialty: st.Specialty,
			Address:   st.Address,
		})
	}
	writeJSON(w, http.StatusOK, service.NewPaginatedResponse(data, total, p.Page, p.Limit))
}

// GetPublicStore handles GET /api/stores/public/{slug}.
func (h *Handlers) GetPublicStore(w http.ResponseWriter, r *http.Request) {
	st, hours, err := h.svc.GetPublicStore(r.Context(), chi.URLParam(r, "slug"))
	if err != nil {
		respondError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, publicStoreDetail{
		ID:            st.ID,
		Name:          st.Name,
		Slug:          st.Slug,
		Description:   st.Description,
		Address:       st.Address,
		Phone:         st.Phone,
		Specialty:     st.Specialty,
		Timezone:      st.Timezone,
		BusinessHours: hours,
	})
}

// ListOwnerStores handles GET /api/stores (owner).
func (h *Handlers) ListOwnerStores(w http.ResponseWriter, r *http.Request) {
	stores, err := h.svc.ListStoresByOwner(r.Context(), h.ownerID)
	if err != nil {
		respondError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, stores)
}

// CreateStore handles POST /api/stores (owner). The slug is auto-generated.
func (h *Handlers) CreateStore(w http.ResponseWriter, r *http.Request) {
	var body createStoreBody
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "validation", "invalid JSON body", "")
		return
	}
	st, err := h.svc.CreateStore(r.Context(), h.ownerID, store.CreateStoreInput{
		Name:        body.Name,
		Description: body.Description,
		Address:     body.Address,
		Phone:       body.Phone,
		Latitude:    body.Latitude,
		Longitude:   body.Longitude,
		Specialty:   body.Specialty,
	})
	if err != nil {
		respondError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, st)
}

// GetStore handles GET /api/stores/{id} (owner).
func (h *Handlers) GetStore(w http.ResponseWriter, r *http.Request) {
	st, hours, blocked, err := h.svc.GetStore(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, storeDetail{Store: st, BusinessHours: hours, BlockedDates: blocked})
}

// UpdateStore handles PUT /api/stores/{id} (owner) applying an allowlist of
// updatable fields.
func (h *Handlers) UpdateStore(w http.ResponseWriter, r *http.Request) {
	var body updateStoreBody
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "validation", "invalid JSON body", "")
		return
	}
	in := store.UpdateStoreInput{
		Name:                body.Name,
		Description:         body.Description,
		Address:             body.Address,
		Phone:               body.Phone,
		Latitude:            body.Latitude,
		Longitude:           body.Longitude,
		Specialty:           body.Specialty,
		SlotDuration:        body.SlotDuration,
		MaxParallelBookings: body.MaxParallelBookings,
		MaxSlotsPerDay:      body.MaxSlotsPerDay,
		CancelationLimit:    body.CancelationLimit,
	}
	st, err := h.svc.UpdateStore(r.Context(), chi.URLParam(r, "id"), in)
	if err != nil {
		respondError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, st)
}
