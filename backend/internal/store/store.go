// Package store implements the PostgreSQL data access layer for the
// appointments API using pgx (pgxpool). Every query is parametrized; the
// package owns all SQL and maps rows to the domain structs below.
package store

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// DB wraps the pgx connection pool and owns all SQL for the service.
type DB struct {
	pool *pgxpool.Pool
}

// querier is the subset of pgx operations the store needs. Both
// *pgxpool.Pool and pgx.Tx satisfy it, so the same query functions run
// against the pool or inside a transaction (booking path).
type querier interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

// New creates a DB backed by the given connection pool.
func New(pool *pgxpool.Pool) *DB {
	return &DB{pool: pool}
}

// Pool exposes the underlying pool for callers that need raw access
// (e.g. the booking transaction in the service layer).
func (db *DB) Pool() *pgxpool.Pool {
	return db.pool
}

// Ping verifies connectivity to the database.
func (db *DB) Ping(ctx context.Context) error {
	return db.pool.Ping(ctx)
}

// AppointmentStatus mirrors the appointment_status Postgres enum.
type AppointmentStatus string

const (
	StatusPending   AppointmentStatus = "PENDING"
	StatusConfirmed AppointmentStatus = "CONFIRMED"
	StatusCancelled AppointmentStatus = "CANCELLED"
	StatusCompleted AppointmentStatus = "COMPLETED"
)

// Store is a single stores row (owner-scoped domain entity).
type Store struct {
	ID                  string   `json:"id"`
	Name                string   `json:"name"`
	Slug                string   `json:"slug"`
	Description         *string  `json:"description"`
	Address             string   `json:"address"`
	Phone               *string  `json:"phone"`
	Latitude            *float64 `json:"latitude"`
	Longitude           *float64 `json:"longitude"`
	Specialty           string   `json:"specialty"`
	OwnerID             string   `json:"ownerId"`
	Timezone            string   `json:"timezone"`
	SlotDuration        int      `json:"slotDuration"`
	MaxParallelBookings int      `json:"maxParallelBookings"`
	MaxSlotsPerDay      int      `json:"maxSlotsPerDay"`
	CancelationLimit    int      `json:"cancelationLimit"`
	Suspended           bool     `json:"suspended"`
}

// BusinessHour is a single weekly opening window (day_of_week, HH:MM).
type BusinessHour struct {
	ID        string `json:"id"`
	StoreID   string `json:"storeId"`
	DayOfWeek int    `json:"dayOfWeek"`
	OpenTime  string `json:"openTime"`  // HH:MM
	CloseTime string `json:"closeTime"` // HH:MM
}

// Date is a calendar date (PostgreSQL `date`) serialized as YYYY-MM-DD in
// JSON, matching the wire contract the frontend consumes.
type Date time.Time

// String renders the date as YYYY-MM-DD.
func (d Date) String() string {
	return time.Time(d).Format("2006-01-02")
}

// MarshalJSON renders the date as a bare YYYY-MM-DD string.
func (d Date) MarshalJSON() ([]byte, error) {
	b := make([]byte, 0, 12)
	b = append(b, '"')
	b = time.Time(d).AppendFormat(b, "2006-01-02")
	b = append(b, '"')
	return b, nil
}

// BlockedDate is a single day on which the store takes no bookings.
type BlockedDate struct {
	ID      string  `json:"id"`
	StoreID string  `json:"storeId"`
	Date    Date    `json:"date"`
	Reason  *string `json:"reason"`
}

// Appointment is a single bookings row.
type Appointment struct {
	ID              string            `json:"id"`
	StoreID         string            `json:"storeId"`
	ClientName      string            `json:"clientName"`
	ClientPhone     string            `json:"clientPhone"`
	ClientEmail     string            `json:"clientEmail"`
	DateTime        time.Time         `json:"dateTime"` // RFC3339 UTC
	Service         *string           `json:"service"`
	Status          AppointmentStatus `json:"status"`
	Notes           *string           `json:"notes"`
	ManagementToken *string           `json:"managementToken,omitempty"`
}

// canonical column lists, kept in the exact order scanStore/scanAppointment
// read them so SELECT ... RETURNING statements stay in sync.
const storeColumns = `id, name, slug, description, address, phone, latitude, longitude,
	specialty, owner_id, timezone, slot_duration, max_parallel_bookings,
	max_slots_per_day, cancelation_limit, suspended`

const appointmentColumns = `id, store_id, client_name, client_phone, client_email,
	date_time, service, status, notes, management_token`
