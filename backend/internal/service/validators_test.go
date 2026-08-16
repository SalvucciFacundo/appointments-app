package service

import (
	"testing"
	"time"
)

func TestValidateTimeFormat(t *testing.T) {
	for _, v := range []string{"09:00", "00:00", "23:59"} {
		if err := ValidateTimeFormat(v, "openTime"); err != nil {
			t.Errorf("ValidateTimeFormat(%q, openTime) = %v, want nil", v, err)
		}
	}

	invalid := []struct{ value, field, want string }{
		{"9:00", "openTime", "openTime must be in HH:MM format"},
		{"25:00", "openTime", "openTime must be in HH:MM format"},
		{"09:60", "closeTime", "closeTime must be in HH:MM format"},
		{"", "openTime", "openTime must be in HH:MM format"},
	}
	for _, tc := range invalid {
		err := ValidateTimeFormat(tc.value, tc.field)
		if err == nil || err.Error() != tc.want {
			t.Errorf("ValidateTimeFormat(%q, %q) = %v, want %q", tc.value, tc.field, err, tc.want)
		}
	}
}

func TestValidateDayOfWeek(t *testing.T) {
	for _, v := range []int{0, 3, 6} {
		if err := ValidateDayOfWeek(v); err != nil {
			t.Errorf("ValidateDayOfWeek(%d) = %v, want nil", v, err)
		}
	}
	for _, v := range []int{-1, 7} {
		if err := ValidateDayOfWeek(v); err == nil {
			t.Errorf("ValidateDayOfWeek(%d) = nil, want error", v)
		}
	}
}

func TestValidateFutureDate(t *testing.T) {
	future := time.Now().AddDate(1, 0, 0).Format("2006-01-02")
	past := time.Now().AddDate(-1, 0, 0).Format("2006-01-02")

	if err := ValidateFutureDate(future); err != nil {
		t.Errorf("ValidateFutureDate(%q) = %v, want nil", future, err)
	}
	if err := ValidateFutureDate(past); err == nil {
		t.Errorf("ValidateFutureDate(%q) = nil, want error", past)
	}
	for _, v := range []string{"not-a-date", ""} {
		if err := ValidateFutureDate(v); err == nil {
			t.Errorf("ValidateFutureDate(%q) = nil, want error", v)
		}
	}
}
