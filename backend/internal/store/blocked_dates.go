package store

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// CreateBlockedDate blocks a single calendar date for a store and returns the
// created row with its generated ID.
func (db *DB) CreateBlockedDate(ctx context.Context, storeID string, date Date, reason *string) (BlockedDate, error) {
	id := uuid.NewString()
	if _, err := db.pool.Exec(ctx, `
		INSERT INTO blocked_dates (id, store_id, date, reason)
		VALUES ($1, $2, $3, $4)`,
		id, storeID, date.String(), reason); err != nil {
		return BlockedDate{}, err
	}
	return BlockedDate{ID: id, StoreID: storeID, Date: date, Reason: reason}, nil
}

// DeleteBlockedDate removes a blocked date by id, returning pgx.ErrNoRows if
// it does not exist.
func (db *DB) DeleteBlockedDate(ctx context.Context, id string) error {
	tag, err := db.pool.Exec(ctx, `DELETE FROM blocked_dates WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

// ListBlockedDates returns all blocked dates for a store, ordered by date.
func (db *DB) ListBlockedDates(ctx context.Context, storeID string) ([]BlockedDate, error) {
	return listBlockedDates(ctx, db.pool, storeID)
}

// listBlockedDates reads through the given querier (pool or tx).
func listBlockedDates(ctx context.Context, q querier, storeID string) ([]BlockedDate, error) {
	rows, err := q.Query(ctx, `
		SELECT id, store_id, date, reason
		FROM blocked_dates WHERE store_id = $1 ORDER BY date`, storeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []BlockedDate{}
	for rows.Next() {
		var bd BlockedDate
		var t time.Time
		if err := rows.Scan(&bd.ID, &bd.StoreID, &t, &bd.Reason); err != nil {
			return nil, err
		}
		bd.Date = Date(t)
		out = append(out, bd)
	}
	return out, rows.Err()
}
