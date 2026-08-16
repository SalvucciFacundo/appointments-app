package store

import (
	"context"

	"github.com/google/uuid"
)

// BusinessHourInput is a weekly opening window without a row ID (the store
// layer generates it on replace).
type BusinessHourInput struct {
	DayOfWeek int    `json:"dayOfWeek"`
	OpenTime  string `json:"openTime"`  // HH:MM
	CloseTime string `json:"closeTime"` // HH:MM
}

// ReplaceBusinessHours atomically replaces all business hours for a store with
// the given set (delete + insert in one transaction) and returns the created
// rows with their generated IDs.
func (db *DB) ReplaceBusinessHours(ctx context.Context, storeID string, in []BusinessHourInput) ([]BusinessHour, error) {
	tx, err := db.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck // no-op after commit

	if _, err := tx.Exec(ctx, `DELETE FROM business_hours WHERE store_id = $1`, storeID); err != nil {
		return nil, err
	}

	out := make([]BusinessHour, 0, len(in))
	for _, h := range in {
		id := uuid.NewString()
		if _, err := tx.Exec(ctx, `
			INSERT INTO business_hours (id, store_id, day_of_week, open_time, close_time)
			VALUES ($1, $2, $3, $4, $5)`,
			id, storeID, h.DayOfWeek, h.OpenTime, h.CloseTime); err != nil {
			return nil, err
		}
		out = append(out, BusinessHour{
			ID:        id,
			StoreID:   storeID,
			DayOfWeek: h.DayOfWeek,
			OpenTime:  h.OpenTime,
			CloseTime: h.CloseTime,
		})
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return out, nil
}

// ListBusinessHours returns all business hours for a store, ordered by
// day_of_week.
func (db *DB) ListBusinessHours(ctx context.Context, storeID string) ([]BusinessHour, error) {
	return listBusinessHours(ctx, db.pool, storeID)
}

// listBusinessHours reads through the given querier (pool or tx).
func listBusinessHours(ctx context.Context, q querier, storeID string) ([]BusinessHour, error) {
	rows, err := q.Query(ctx, `
		SELECT id, store_id, day_of_week, open_time, close_time
		FROM business_hours WHERE store_id = $1 ORDER BY day_of_week`, storeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []BusinessHour{}
	for rows.Next() {
		var h BusinessHour
		if err := rows.Scan(&h.ID, &h.StoreID, &h.DayOfWeek, &h.OpenTime, &h.CloseTime); err != nil {
			return nil, err
		}
		out = append(out, h)
	}
	return out, rows.Err()
}
