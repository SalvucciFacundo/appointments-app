// Package service holds the pure business logic for the appointments API,
// ported from the original TypeScript `src/lib/*` modules. Functions here are
// side-effect free except where they explicitly take a store dependency
// (e.g. slug uniqueness).
package service

import (
	"errors"
	"fmt"
	"regexp"
	"time"
)

// timeFormatRe matches HH:MM (00:00 through 23:59).
var timeFormatRe = regexp.MustCompile(`^([01]\d|2[0-3]):([0-5]\d)$`)

// ValidateTimeFormat returns an error if value is not in HH:MM format.
func ValidateTimeFormat(value, field string) error {
	if !timeFormatRe.MatchString(value) {
		return fmt.Errorf("%s must be in HH:MM format", field)
	}
	return nil
}

// ValidateDayOfWeek returns an error if value is outside 0..6. In Go the
// non-integer case cannot occur (int), so only the range is checked.
func ValidateDayOfWeek(value int) error {
	if value < 0 || value > 6 {
		return errors.New("dayOfWeek must be an integer between 0 and 6")
	}
	return nil
}

// ValidateFutureDate returns an error if dateStr is not a valid YYYY-MM-DD
// date, or if it is not today or later.
func ValidateFutureDate(dateStr string) error {
	d, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		return errors.New("Invalid date format. Use YYYY-MM-DD")
	}
	now := time.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.Local)
	if d.Before(today) {
		return errors.New("Date must be in the future")
	}
	return nil
}
