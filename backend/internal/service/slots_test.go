package service

import (
	"testing"
	"time"

	"github.com/salvuccifacundo/appointments-app/backend/internal/store"
)

// hours builds a BusinessHour with the given window (ID/StoreID unused by the
// pure function).
func hours(day int, open, close string) store.BusinessHour {
	return store.BusinessHour{DayOfWeek: day, OpenTime: open, CloseTime: close}
}

// appt builds an appointment at the given absolute time and status.
func appt(t time.Time, status store.AppointmentStatus) store.Appointment {
	return store.Appointment{DateTime: t, Status: status}
}

// baseStore: Mon-Fri 09:00-17:00, 60-min slots, maxParallel 1, unlimited/day,
// Buenos Aires timezone (UTC-3, no DST).
func baseStore() SlotStoreInput {
	return SlotStoreInput{
		Timezone:            "America/Argentina/Buenos_Aires",
		SlotDuration:        60,
		MaxParallelBookings: 1,
		MaxSlotsPerDay:      0,
		BusinessHours:       []store.BusinessHour{hours(1, "09:00", "17:00"), hours(2, "09:00", "17:00"), hours(3, "09:00", "17:00"), hours(4, "09:00", "17:00"), hours(5, "09:00", "17:00")},
	}
}

// artTime builds a time in the Buenos Aires location.
func artTime(y int, m time.Month, d, hh, mm int) time.Time {
	loc, err := time.LoadLocation("America/Argentina/Buenos_Aires")
	if err != nil {
		panic(err)
	}
	return time.Date(y, m, d, hh, mm, 0, 0, loc)
}

func TestAvailableSlots_RespectsBusinessHours(t *testing.T) {
	// 2026-07-22 is a Wednesday: 09:00-17:00 = 8 slots of 60 min.
	slots, err := AvailableSlots(baseStore(), "2026-07-22", nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(slots) != 8 {
		t.Fatalf("got %d slots, want 8", len(slots))
	}
	if slots[0].Start != "09:00" || slots[0].End != "10:00" || !slots[0].Available || slots[0].CurrentBookings != 0 {
		t.Errorf("first slot = %+v, want 09:00-10:00 available", slots[0])
	}
	if slots[7].Start != "16:00" || slots[7].End != "17:00" {
		t.Errorf("last slot = %+v, want 16:00-17:00", slots[7])
	}
}

func TestAvailableSlots_BlockedDate(t *testing.T) {
	s := baseStore()
	s.BlockedDates = []store.BlockedDate{{Date: store.Date(artTime(2026, 7, 22, 0, 0))}}
	slots, err := AvailableSlots(s, "2026-07-22", nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(slots) != 0 {
		t.Fatalf("got %d slots, want 0 for blocked date", len(slots))
	}
}

func TestAvailableSlots_NoBusinessHours(t *testing.T) {
	// 2026-07-19 is a Sunday (baseStore has Mon-Fri only).
	slots, err := AvailableSlots(baseStore(), "2026-07-19", nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(slots) != 0 {
		t.Fatalf("got %d slots, want 0 for a day with no hours", len(slots))
	}
}

func TestAvailableSlots_EmptyBusinessHours(t *testing.T) {
	s := baseStore()
	s.BusinessHours = nil
	slots, err := AvailableSlots(s, "2026-07-22", nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(slots) != 0 {
		t.Fatalf("got %d slots, want 0", len(slots))
	}
}

func TestAvailableSlots_CancelledDoesNotOccupy(t *testing.T) {
	s := baseStore()
	existing := []store.Appointment{appt(artTime(2026, 7, 22, 10, 0), store.StatusCancelled)}
	slots, err := AvailableSlots(s, "2026-07-22", existing)
	if err != nil {
		t.Fatal(err)
	}
	// 10:00 slot is index 1.
	if !slots[1].Available {
		t.Errorf("10:00 slot unavailable; CANCELLED must not occupy capacity")
	}
	if slots[1].CurrentBookings != 0 {
		t.Errorf("10:00 slot currentBookings = %d, want 0", slots[1].CurrentBookings)
	}
}

func TestAvailableSlots_CompletedOccupies(t *testing.T) {
	s := baseStore()
	existing := []store.Appointment{appt(artTime(2026, 7, 22, 10, 0), store.StatusCompleted)}
	slots, err := AvailableSlots(s, "2026-07-22", existing)
	if err != nil {
		t.Fatal(err)
	}
	if slots[1].Available {
		t.Errorf("10:00 slot available; COMPLETED must occupy capacity")
	}
	if slots[1].CurrentBookings != 1 {
		t.Errorf("10:00 slot currentBookings = %d, want 1", slots[1].CurrentBookings)
	}
}

func TestAvailableSlots_MaxParallelCapacity(t *testing.T) {
	s := baseStore()
	s.MaxParallelBookings = 2
	existing := []store.Appointment{
		appt(artTime(2026, 7, 22, 9, 0), store.StatusConfirmed),
		appt(artTime(2026, 7, 22, 9, 0), store.StatusConfirmed),
	}
	slots, err := AvailableSlots(s, "2026-07-22", existing)
	if err != nil {
		t.Fatal(err)
	}
	if slots[0].Available {
		t.Errorf("09:00 slot available with 2/2 bookings")
	}
	if slots[0].CurrentBookings != 2 {
		t.Errorf("09:00 slot currentBookings = %d, want 2", slots[0].CurrentBookings)
	}
	if !slots[1].Available {
		t.Errorf("10:00 slot should be free")
	}
}

func TestAvailableSlots_MaxSlotsPerDay(t *testing.T) {
	s := baseStore()
	s.MaxSlotsPerDay = 2
	existing := []store.Appointment{
		appt(artTime(2026, 7, 22, 9, 0), store.StatusConfirmed),
		appt(artTime(2026, 7, 22, 10, 0), store.StatusConfirmed),
	}
	slots, err := AvailableSlots(s, "2026-07-22", existing)
	if err != nil {
		t.Fatal(err)
	}
	for i, sl := range slots {
		if sl.Available {
			t.Errorf("slot %d (%s) available; maxSlotsPerDay=2 already reached", i, sl.Start)
		}
	}
}

func TestAvailableSlots_TimezoneAware(t *testing.T) {
	s := baseStore()
	s.MaxParallelBookings = 2
	// 12:00 UTC = 09:00 in Buenos Aires (UTC-3).
	utcNoon := time.Date(2026, 7, 22, 12, 0, 0, 0, time.UTC)
	existing := []store.Appointment{
		appt(utcNoon, store.StatusConfirmed),
		appt(utcNoon, store.StatusConfirmed),
	}
	slots, err := AvailableSlots(s, "2026-07-22", existing)
	if err != nil {
		t.Fatal(err)
	}
	if slots[0].CurrentBookings != 2 || slots[0].Available {
		t.Errorf("09:00 slot = %+v, want 2 bookings / unavailable", slots[0])
	}
	if !slots[1].Available {
		t.Errorf("10:00 slot should be available")
	}
}

func TestAvailableSlots_CrossMidnight(t *testing.T) {
	s := baseStore()
	s.BusinessHours = []store.BusinessHour{hours(3, "20:00", "02:00")}
	slots, err := AvailableSlots(s, "2026-07-22", nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(slots) != 0 {
		t.Fatalf("got %d slots, want 0 for cross-midnight hours", len(slots))
	}
}

func TestLocalDayWindow_DST(t *testing.T) {
	loc, err := time.LoadLocation("America/New_York")
	if err != nil {
		t.Skipf("tzdata unavailable: %v", err)
	}

	spring, _ := time.Parse("2006-01-02", "2026-03-08")
	start, end := localDayWindow(loc, spring)
	if got := end.Sub(start); got != 23*time.Hour {
		t.Errorf("spring-forward day window = %v, want 23h", got)
	}

	fall, _ := time.Parse("2006-01-02", "2026-11-01")
	start, end = localDayWindow(loc, fall)
	if got := end.Sub(start); got != 25*time.Hour {
		t.Errorf("fall-back day window = %v, want 25h", got)
	}
}

func TestAvailableSlots_DSTDayBoundary(t *testing.T) {
	loc, err := time.LoadLocation("America/New_York")
	if err != nil {
		t.Skipf("tzdata unavailable: %v", err)
	}

	// Sunday 2026-03-08 is spring-forward (23h day). A booking at local 23:30
	// on the previous day (Sat 2026-03-07, EST) lands at 04:30 UTC — before
	// Sunday's local window opens at 05:00 UTC. With maxSlotsPerDay=1, if the
	// booking incorrectly spilled into Sunday every slot would be unavailable.
	satNight := time.Date(2026, 3, 7, 23, 30, 0, 0, loc)

	s := SlotStoreInput{
		Timezone:            "America/New_York",
		SlotDuration:        60,
		MaxParallelBookings: 1,
		MaxSlotsPerDay:      1,
		BusinessHours:       []store.BusinessHour{hours(0, "09:00", "17:00")}, // Sunday only
	}

	slots, err := AvailableSlots(s, "2026-03-08", []store.Appointment{appt(satNight, store.StatusConfirmed)})
	if err != nil {
		t.Fatal(err)
	}
	if len(slots) == 0 {
		t.Fatal("expected slots for Sunday")
	}
	for _, sl := range slots {
		if !sl.Available {
			t.Errorf("slot %s unavailable; previous-day booking leaked into Sunday", sl.Start)
		}
	}
}
