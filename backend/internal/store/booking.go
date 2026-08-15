package store

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
)

// LockStoreBySlugForUpdate locks the store row (SELECT ... FOR UPDATE) inside
// the given transaction, serializing concurrent bookings for the same store.
// It returns pgx.ErrNoRows when no store uses the slug.
func LockStoreBySlugForUpdate(ctx context.Context, tx pgx.Tx, slug string) (Store, error) {
	row := tx.QueryRow(ctx, `SELECT `+storeColumns+`
		FROM stores WHERE slug = $1 FOR UPDATE`, slug)
	return scanStore(row)
}

// AppointmentsInWindowTx mirrors AppointmentsInWindow but reads through an
// open transaction so it observes the state after the store lock is held.
func AppointmentsInWindowTx(ctx context.Context, tx pgx.Tx, storeID string, start, end time.Time) ([]Appointment, error) {
	return appointmentsInWindow(ctx, tx, storeID, start, end)
}

// CreateAppointmentTx mirrors CreateAppointment but inserts through an open
// transaction.
func CreateAppointmentTx(ctx context.Context, tx pgx.Tx, in CreateAppointmentInput) (Appointment, error) {
	return createAppointment(ctx, tx, in)
}

// ListBusinessHoursTx mirrors ListBusinessHours but reads through an open
// transaction.
func ListBusinessHoursTx(ctx context.Context, tx pgx.Tx, storeID string) ([]BusinessHour, error) {
	return listBusinessHours(ctx, tx, storeID)
}

// ListBlockedDatesTx mirrors ListBlockedDates but reads through an open
// transaction.
func ListBlockedDatesTx(ctx context.Context, tx pgx.Tx, storeID string) ([]BlockedDate, error) {
	return listBlockedDates(ctx, tx, storeID)
}
