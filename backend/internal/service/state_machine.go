package service

import (
	"fmt"
	"strings"

	"github.com/salvuccifacundo/appointments-app/backend/internal/store"
)

// actionToStatus maps a state-machine action (matched case-insensitively) to
// the appointment status it produces.
var actionToStatus = map[string]store.AppointmentStatus{
	"CONFIRM":  store.StatusConfirmed,
	"REJECT":   store.StatusCancelled,
	"COMPLETE": store.StatusCompleted,
}

// validTransitions lists, for each non-terminal status, the target statuses
// reachable from it. Terminal statuses (CANCELLED, COMPLETED) are absent.
var validTransitions = map[store.AppointmentStatus][]store.AppointmentStatus{
	store.StatusPending:   {store.StatusConfirmed, store.StatusCancelled},
	store.StatusConfirmed: {store.StatusCompleted, store.StatusCancelled},
}

// ValidateTransition validates the transition implied by action from the
// current appointment status, returning the target status.
//
// Actions are case-insensitive: CONFIRM → CONFIRMED, REJECT → CANCELLED,
// COMPLETE → COMPLETED. Terminal statuses have no valid transitions. Any
// invalid action or transition returns a *FieldError with Field "action".
func ValidateTransition(current store.AppointmentStatus, action string) (store.AppointmentStatus, error) {
	target, ok := actionToStatus[strings.ToUpper(action)]
	if !ok {
		return "", &FieldError{
			Field:   "action",
			Message: "action must be CONFIRM, REJECT, or COMPLETE",
		}
	}

	for _, allowed := range validTransitions[current] {
		if allowed == target {
			return target, nil
		}
	}

	return "", &FieldError{
		Field:   "action",
		Message: fmt.Sprintf("cannot transition from %s to %s", current, target),
	}
}
