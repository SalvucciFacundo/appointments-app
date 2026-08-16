package middleware

import (
	"encoding/json"
	"net/http"
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

// writeError writes the error contract with the given status code.
func writeError(w http.ResponseWriter, status int, code, message, field string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(errorBody{Error: errorDetail{Code: code, Message: message, Field: field}})
}
