// Package http wires the chi router, middleware, and handlers into the
// public HTTP surface of the appointments API.
package http

import (
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/salvuccifacundo/appointments-app/backend/internal/config"
	"github.com/salvuccifacundo/appointments-app/backend/internal/http/handlers"
	"github.com/salvuccifacundo/appointments-app/backend/internal/http/middleware"
)

// NewRouter builds the full HTTP surface: global middleware (CORS, logging,
// recover, rate limit), the public routes, and the API-key-protected owner
// routes.
func NewRouter(cfg *config.Config, svc handlers.Service) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.CORS(cfg.CORSOrigins))
	r.Use(middleware.Logging(slog.Default()))
	r.Use(middleware.Recover(slog.Default()))
	r.Use(middleware.RateLimit(cfg.APIKey))

	r.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	h := handlers.New(svc, cfg.OwnerID)

	// Public routes: store discovery, slots, and booking.
	r.Get("/api/stores/public", h.ListPublicStores)
	r.Get("/api/stores/public/{slug}", h.GetPublicStore)
	r.Get("/api/stores/{slug}/slots", h.GetSlots)
	r.Post("/api/stores/{slug}/book", h.Book)

	// Owner routes: require the dashboard API key.
	r.Group(func(r chi.Router) {
		r.Use(middleware.RequireAPIKey(cfg.APIKey))

		r.Get("/api/stores", h.ListOwnerStores)
		r.Post("/api/stores", h.CreateStore)
		r.Get("/api/stores/{id}", h.GetStore)
		r.Put("/api/stores/{id}", h.UpdateStore)
		r.Put("/api/stores/{id}/hours", h.UpdateHours)
		r.Post("/api/stores/{id}/blocked-dates", h.CreateBlockedDate)
		r.Delete("/api/stores/{id}/blocked-dates/{bid}", h.DeleteBlockedDate)
		r.Get("/api/stores/{id}/appointments", h.ListAppointments)
		r.Post("/api/stores/{id}/appointments", h.CreateAppointment)
		r.Put("/api/stores/{id}/appointments/{aid}", h.UpdateAppointmentStatus)
		r.Put("/api/stores/{id}/appointments/{aid}/reschedule", h.RescheduleAppointment)
	})

	return r
}
