package service

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/salvuccifacundo/appointments-app/backend/internal/store"
)

// testDate is a fixed Monday in the future (2027-01-04), matching the
// Monday-only business hours newTestStore installs.
const testDate = "2027-01-04"

// testPool connects to the throwaway test database and applies the schema if
// needed. It skips when DATABASE_URL_TEST is not set.
func testPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("DATABASE_URL_TEST")
	if url == "" {
		t.Skip("DATABASE_URL_TEST not set; skipping booking integration test")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	t.Cleanup(pool.Close)
	if err := pool.Ping(ctx); err != nil {
		t.Fatalf("ping: %v", err)
	}
	if err := ensureSchema(ctx, pool); err != nil {
		t.Fatalf("schema: %v", err)
	}
	return pool
}

// ensureSchema applies the init migration when the stores table is absent.
// Migrations use the goose single-file format (+goose Up / +goose Down), so
// only the Up section is executed.
func ensureSchema(ctx context.Context, pool *pgxpool.Pool) error {
	var exists bool
	if err := pool.QueryRow(ctx, `SELECT to_regclass('public.stores') IS NOT NULL`).Scan(&exists); err != nil {
		return err
	}
	if exists {
		return nil
	}
	raw, err := os.ReadFile("../../migrations/00001_init.sql")
	if err != nil {
		return fmt.Errorf("read migration: %w", err)
	}
	up := migrationUpSection(string(raw))
	for _, stmt := range strings.Split(up, ";") {
		stmt = strings.TrimSpace(stmt)
		if stmt == "" {
			continue
		}
		if _, err := pool.Exec(ctx, stmt); err != nil {
			return fmt.Errorf("exec %q: %w", firstLine(stmt), err)
		}
	}
	return nil
}

// migrationUpSection returns the SQL between the +goose Up and +goose Down
// directives, dropping any statement directive lines.
func migrationUpSection(raw string) string {
	lines := strings.Split(raw, "\n")
	start, end := -1, len(lines)
	for i, l := range lines {
		trimmed := strings.TrimSpace(l)
		if trimmed == "-- +goose Up" {
			start = i + 1
		}
		if trimmed == "-- +goose Down" && start >= 0 {
			end = i
			break
		}
	}
	if start < 0 {
		return ""
	}
	return strings.Join(lines[start:end], "\n")
}

func firstLine(s string) string {
	if i := strings.IndexByte(s, '\n'); i >= 0 {
		return s[:i]
	}
	return s
}

// newTestStore creates a user + store with a single Monday 09:00-10:00 slot
// (60-min, maxParallelBookings=1, Buenos Aires) and returns the store together
// with the owner id the store belongs to.
func newTestStore(t *testing.T, ctx context.Context, db *store.DB) (store.Store, string) {
	t.Helper()
	userID := "test-user-" + uuid.NewString()
	if _, err := db.Pool().Exec(ctx,
		`INSERT INTO users (id, name, email) VALUES ($1, $2, $3)`,
		userID, "Test Owner", userID+"@example.com"); err != nil {
		t.Fatalf("insert user: %v", err)
	}

	st, err := db.CreateStore(ctx, store.CreateStoreInput{
		Name:                "Test Clinic",
		Slug:                "test-" + uuid.NewString(),
		Address:             "123 Test St",
		Specialty:           "General",
		OwnerID:             userID,
		Timezone:            "America/Argentina/Buenos_Aires",
		SlotDuration:        60,
		MaxParallelBookings: 1,
		MaxSlotsPerDay:      0,
		CancelationLimit:    2,
	})
	if err != nil {
		t.Fatalf("create store: %v", err)
	}

	// Monday 09:00-10:00 → exactly one bookable slot.
	if _, err := db.ReplaceBusinessHours(ctx, st.ID, []store.BusinessHourInput{
		{DayOfWeek: 1, OpenTime: "09:00", CloseTime: "10:00"},
	}); err != nil {
		t.Fatalf("replace hours: %v", err)
	}
	return st, userID
}

func bookingInput(i int) BookInput {
	return BookInput{
		Date:        testDate,
		Time:        "09:00",
		ClientName:  fmt.Sprintf("Client %d", i),
		ClientPhone: fmt.Sprintf("555-00%02d", i),
		ClientEmail: fmt.Sprintf("client%d@example.com", i),
	}
}

func TestBook_HappyPath(t *testing.T) {
	pool := testPool(t)
	ctx := context.Background()
	db := store.New(pool)
	svc := NewService(db)
	st, _ := newTestStore(t, ctx, db)

	appt, err := svc.Book(ctx, st.Slug, bookingInput(1))
	if err != nil {
		t.Fatalf("Book: %v", err)
	}

	if appt.Status != store.StatusPending {
		t.Errorf("status = %s, want PENDING", appt.Status)
	}
	if appt.ManagementToken == nil || *appt.ManagementToken == "" {
		t.Errorf("managementToken = %v, want generated UUID", appt.ManagementToken)
	}

	// 09:00 in Buenos Aires (UTC-3, no DST) = 12:00 UTC.
	want := time.Date(2027, 1, 4, 12, 0, 0, 0, time.UTC)
	if !appt.DateTime.Equal(want) {
		t.Errorf("dateTime = %v, want %v", appt.DateTime, want)
	}
}

func TestBook_SlotUnavailable(t *testing.T) {
	pool := testPool(t)
	ctx := context.Background()
	db := store.New(pool)
	svc := NewService(db)
	st, _ := newTestStore(t, ctx, db)

	if _, err := svc.Book(ctx, st.Slug, bookingInput(1)); err != nil {
		t.Fatalf("first Book: %v", err)
	}

	_, err := svc.Book(ctx, st.Slug, bookingInput(2))
	if !errors.Is(err, ErrSlotUnavailable) {
		t.Errorf("second Book error = %v, want ErrSlotUnavailable", err)
	}
}

func TestBook_UnknownSlug(t *testing.T) {
	pool := testPool(t)
	ctx := context.Background()
	svc := NewService(store.New(pool))

	_, err := svc.Book(ctx, "no-such-slug", bookingInput(1))
	if !errors.Is(err, ErrNotFound) {
		t.Errorf("Book(unknown slug) error = %v, want ErrNotFound", err)
	}
}

func TestBook_MissingClientName(t *testing.T) {
	// Input validation runs before any DB access, so no database is required.
	svc := NewService(store.New(nil))
	in := bookingInput(1)
	in.ClientName = ""
	_, err := svc.Book(context.Background(), "x", in)
	var fe *FieldError
	if !errors.As(err, &fe) || fe.Field != "clientName" {
		t.Errorf("Book(missing clientName) error = %v, want FieldError{clientName}", err)
	}
}

func TestBook_InvalidTimeFormat(t *testing.T) {
	svc := NewService(store.New(nil))
	in := bookingInput(1)
	in.Time = "9:00"
	_, err := svc.Book(context.Background(), "x", in)
	var fe *FieldError
	if !errors.As(err, &fe) || fe.Field != "time" {
		t.Errorf("Book(bad time) error = %v, want FieldError{time}", err)
	}
}

func TestBook_ConcurrentSingleSlot(t *testing.T) {
	pool := testPool(t)
	ctx := context.Background()
	db := store.New(pool)
	svc := NewService(db)
	st, _ := newTestStore(t, ctx, db)

	const n = 10
	var success, conflict atomic.Int64
	var wg sync.WaitGroup
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			_, err := svc.Book(ctx, st.Slug, bookingInput(i))
			switch {
			case err == nil:
				success.Add(1)
			case errors.Is(err, ErrSlotUnavailable):
				conflict.Add(1)
			default:
				t.Errorf("goroutine %d: unexpected error: %v", i, err)
			}
		}(i)
	}
	wg.Wait()

	if got := success.Load(); got != 1 {
		t.Errorf("successes = %d, want exactly 1", got)
	}
	if got := conflict.Load(); got != n-1 {
		t.Errorf("conflicts = %d, want %d", got, n-1)
	}
}
