package service

import "errors"

// FieldError is an input validation error tied to a request field. The HTTP
// layer maps it to 400 with the {code, message, field} contract.
type FieldError struct {
	Field   string
	Message string
}

// Error implements the error interface.
func (e *FieldError) Error() string { return e.Message }

// ConflictError is a business-rule conflict. The HTTP layer maps it to 409
// using Code as error.code.
type ConflictError struct {
	Code    string
	Message string
}

// Error implements the error interface.
func (e *ConflictError) Error() string { return e.Message }

// ErrSlotUnavailable is returned by Book when the requested slot is at (or
// beyond) capacity. It maps to HTTP 409 with error.code = "slot_unavailable".
var ErrSlotUnavailable = &ConflictError{
	Code:    "slot_unavailable",
	Message: "slot is no longer available",
}

// ErrNotFound is returned when a store is not found by slug. It maps to 404.
var ErrNotFound = errors.New("not found")
