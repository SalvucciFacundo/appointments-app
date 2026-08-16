package handlers

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/salvuccifacundo/appointments-app/backend/internal/service"
)

// errorDetail is one entry of the API error contract
// {error:{code,message,field}}.
type errorDetail struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Field   string `json:"field,omitempty"`
}

type errorBody struct {
	Error errorDetail `json:"error"`
}

// writeJSON writes v as JSON with the given status code.
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if v != nil {
		_ = json.NewEncoder(w).Encode(v)
	}
}

// writeError writes the error contract with an optional field.
func writeError(w http.ResponseWriter, status int, code, message, field string) {
	writeJSON(w, status, errorBody{Error: errorDetail{Code: code, Message: message, Field: field}})
}

// respondError maps a service error to the HTTP error contract:
// FieldError → 400, ConflictError → 409 (with its code), ErrNotFound → 404,
// anything else → 500 internal.
func respondError(w http.ResponseWriter, err error) {
	var fe *service.FieldError
	if errors.As(err, &fe) {
		writeError(w, http.StatusBadRequest, "validation", fe.Message, fe.Field)
		return
	}
	var ce *service.ConflictError
	if errors.As(err, &ce) {
		writeError(w, http.StatusConflict, ce.Code, ce.Message, "")
		return
	}
	if errors.Is(err, service.ErrNotFound) {
		writeError(w, http.StatusNotFound, "not_found", "resource not found", "")
		return
	}
	slog.Error("internal error", "error", err)
	writeError(w, http.StatusInternalServerError, "internal", "internal server error", "")
}

// decodeJSON decodes the request body into dst, returning an error for
// malformed or empty JSON so the handler can respond 400.
func decodeJSON(r *http.Request, dst any) error {
	dec := json.NewDecoder(r.Body)
	if err := dec.Decode(dst); err != nil {
		return err
	}
	return nil
}
