package middleware

import "crypto/subtle"

// SecureEqual compares two strings in constant time to avoid timing attacks.
// It is shared by the auth and rate-limit middleware (the legacy
// RequireAPIKey middleware that used it was removed in the auth change).
func SecureEqual(a, b string) bool {
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}
