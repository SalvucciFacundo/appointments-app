package service

import (
	"fmt"
	"time"
	_ "time/tzdata" // embed tzdata so LoadLocation works on distroless images

	"github.com/salvuccifacundo/appointments-app/backend/internal/store"
)

// TimeSlot is one bookable window rendered as HH:MM boundaries.
type TimeSlot struct {
	Start           string `json:"start"` // HH:MM
	End             string `json:"end"`   // HH:MM
	Available       bool   `json:"available"`
	CurrentBookings int    `json:"currentBookings"`
}

// SlotStoreInput is the subset of store data required to compute availability.
type SlotStoreInput struct {
	Timezone            string
	SlotDuration        int
	MaxParallelBookings int
	MaxSlotsPerDay      int
	BusinessHours       []store.BusinessHour
	BlockedDates        []store.BlockedDate
}

// AvailableSlots computes the available time slots for a local date in the
// store's timezone.
//
// Rules:
//   - A blocked date or a day without business hours yields no slots.
//   - Windows are [open, close) stepped by slotDuration, including a window
//     only when start+slotDuration <= close.
//   - CANCELLED appointments do not occupy capacity; every other status does.
//   - maxSlotsPerDay == 0 means unlimited; otherwise the whole day becomes
//     unavailable once the day's non-cancelled bookings reach the limit.
func AvailableSlots(s SlotStoreInput, date string, existing []store.Appointment) ([]TimeSlot, error) {
	tz := s.Timezone
	if tz == "" {
		tz = "UTC"
	}
	loc, err := time.LoadLocation(tz)
	if err != nil {
		return nil, fmt.Errorf("invalid timezone %q: %w", tz, err)
	}

	d, err := time.Parse("2006-01-02", date)
	if err != nil {
		return nil, fmt.Errorf("invalid date %q: must be YYYY-MM-DD", date)
	}

	for _, bd := range s.BlockedDates {
		if bd.Date.String() == date {
			return []TimeSlot{}, nil
		}
	}

	dayOfWeek := int(d.Weekday())
	var hours *store.BusinessHour
	for i := range s.BusinessHours {
		if s.BusinessHours[i].DayOfWeek == dayOfWeek {
			hours = &s.BusinessHours[i]
			break
		}
	}
	if hours == nil {
		return []TimeSlot{}, nil
	}

	openMin, err := toMinutes(hours.OpenTime)
	if err != nil {
		return nil, err
	}
	closeMin, err := toMinutes(hours.CloseTime)
	if err != nil {
		return nil, err
	}

	if s.SlotDuration <= 0 {
		return nil, fmt.Errorf("slotDuration must be positive, got %d", s.SlotDuration)
	}

	type window struct{ start, end int }
	windows := make([]window, 0)
	for start := openMin; start+s.SlotDuration <= closeMin; start += s.SlotDuration {
		windows = append(windows, window{start, start + s.SlotDuration})
	}
	if len(windows) == 0 {
		return []TimeSlot{}, nil
	}

	// DST-safe local day window in UTC (AddDate, not Add(24h)).
	startUTC, endUTC := localDayWindow(loc, d)

	// Non-cancelled appointments whose local date equals the requested date.
	var onDate []store.Appointment
	for _, a := range existing {
		if a.Status == store.StatusCancelled {
			continue
		}
		if !a.DateTime.Before(startUTC) && a.DateTime.Before(endUTC) {
			onDate = append(onDate, a)
		}
	}
	totalOnDate := len(onDate)

	withinDailyLimit := s.MaxSlotsPerDay == 0 || totalOnDate < s.MaxSlotsPerDay

	slots := make([]TimeSlot, 0, len(windows))
	for _, w := range windows {
		count := 0
		for _, a := range onDate {
			local := a.DateTime.In(loc)
			m := local.Hour()*60 + local.Minute()
			if m >= w.start && m < w.end {
				count++
			}
		}
		slots = append(slots, TimeSlot{
			Start:           toTimeString(w.start),
			End:             toTimeString(w.end),
			Available:       count < s.MaxParallelBookings && withinDailyLimit,
			CurrentBookings: count,
		})
	}
	return slots, nil
}

// localDayWindow returns the half-open UTC window [start, end) covering the
// local calendar date in loc. The end is computed with AddDate (DST-safe),
// so a spring-forward day yields 23h and a fall-back day yields 25h.
func localDayWindow(loc *time.Location, d time.Time) (start, end time.Time) {
	y, m, day := d.Date()
	localStart := time.Date(y, m, day, 0, 0, 0, 0, loc)
	localEnd := localStart.AddDate(0, 0, 1)
	return localStart.UTC(), localEnd.UTC()
}

// toMinutes parses an HH:MM string into minutes since midnight.
func toMinutes(t string) (int, error) {
	parsed, err := time.Parse("15:04", t)
	if err != nil {
		return 0, fmt.Errorf("invalid time %q: must be HH:MM", t)
	}
	return parsed.Hour()*60 + parsed.Minute(), nil
}

// toTimeString formats minutes since midnight as HH:MM.
func toTimeString(minutes int) string {
	return fmt.Sprintf("%02d:%02d", minutes/60, minutes%60)
}
