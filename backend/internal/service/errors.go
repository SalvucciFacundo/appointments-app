package service

// FieldError is an input validation error tied to a request field. The HTTP
// layer maps it to 400 with the {code, message, field} contract.
type FieldError struct {
	Field   string
	Message string
}

// Error implements the error interface.
func (e *FieldError) Error() string { return e.Message }
