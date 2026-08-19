// Command api is the entrypoint for the appointments backend REST API.
//
// Wiring order follows the architecture: config -> pool -> store -> service ->
// router -> server, with graceful shutdown.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/salvuccifacundo/appointments-app/backend/internal/config"
	apihttp "github.com/salvuccifacundo/appointments-app/backend/internal/http"
	"github.com/salvuccifacundo/appointments-app/backend/internal/service"
	"github.com/salvuccifacundo/appointments-app/backend/internal/store"
)

func main() {
	if err := run(); err != nil {
		slog.Error("api exited", "error", err)
		os.Exit(1)
	}
}

func run() error {
	cfg := config.Load()

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()

	db := store.New(pool)
	svc := service.NewService(db, service.Options{
		SessionTTL:     cfg.SessionTTL,
		BootstrapID:    cfg.OwnerID,
		BootstrapEmail: cfg.OwnerBootstrapEmail,
		Argon2Memory:   cfg.Argon2Memory,
		Argon2Time:     cfg.Argon2Time,
	})
	r := apihttp.NewRouter(cfg, svc)

	// Periodically sweep expired sessions; stops with the server context.
	go func() {
		ticker := time.NewTicker(time.Hour)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if err := svc.CleanupExpiredSessions(ctx); err != nil {
					slog.Error("session cleanup failed", "error", err)
				}
			}
		}
	}()

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           r,
		ReadHeaderTimeout: 5 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		slog.Info("api listening", "addr", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
		}
	}()

	select {
	case err := <-errCh:
		return err
	case <-ctx.Done():
	}

	slog.Info("shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	return srv.Shutdown(shutdownCtx)
}
