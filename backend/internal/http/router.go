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
	"github.com/salvuccifacundo/appointments-app/backend/internal/store"
)

// NewRouter builds the full HTTP surface: global middleware (CORS, logging,
// recover, session, rate limit), the public routes, the auth routes, and the
// session/API-key-protected owner routes.
func NewRouter(cfg *config.Config, svc handlers.Service) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.CORS(cfg.CORSOrigins))
	r.Use(middleware.Logging(slog.Default()))
	r.Use(middleware.Recover(slog.Default()))
	r.Use(middleware.Session(svc))
	r.Use(middleware.RateLimit(middleware.IsOwner(cfg.APIKey)))

	r.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	h := handlers.New(svc, handlers.Config{
		CookieSecure: cfg.CookieSecure,
		SessionTTL:   cfg.SessionTTL,
	})

	// Public routes: store discovery, slots, and booking (anonymous PENDING).
	r.Get("/api/stores/public", h.ListPublicStores)
	r.Get("/api/stores/public/{slug}", h.GetPublicStore)
	r.Get("/api/stores/{slug}/slots", h.GetSlots)
	r.Post("/api/stores/{slug}/book", h.Book)

	// Auth routes. /me sits outside the owner group: any authenticated role
	// may read its own profile. Logout is a mutation, so it carries CSRF.
	r.Route("/api/auth", func(r chi.Router) {
		r.Post("/register", h.Register)
		r.Post("/login", h.Login)
		r.With(middleware.CSRF()).Post("/logout", h.Logout)
		r.Get("/me", h.Me)
	})

	// Owner routes: require authentication (session or X-API-Key during the
	// transition), the OWNER role, and CSRF on cookie-authenticated mutations.
	r.Group(func(r chi.Router) {
		r.Use(middleware.RequireAuth(svc, cfg.APIKey, cfg.AuthDisableAPIKey))
		r.Use(middleware.RequireRole(store.RoleOwner))
		r.Use(middleware.CSRF())

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
