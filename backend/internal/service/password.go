package service

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"strings"

	"golang.org/x/crypto/argon2"
)

// Argon2id parameters. Memory and iterations are configurable via
// Options.Argon2Memory/Argon2Time; parallelism and key length are fixed and
// baked into the encoded format.
const (
	argon2Parallelism uint8  = 4
	argon2KeyLen      uint32 = 32
	argon2SaltLen     uint32 = 16
)

// HashPassword hashes password with Argon2id and returns it in the modular
// PHC format:
//
//	$argon2id$v=19$m=<memory>,t=<time>,p=4$<salt_b64>$<hash_b64>
func HashPassword(password string, memory, time uint32) (string, error) {
	salt := make([]byte, argon2SaltLen)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	hash := argon2.IDKey([]byte(password), salt, time, memory, argon2Parallelism, argon2KeyLen)
	return fmt.Sprintf("$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
		argon2.Version, memory, time, argon2Parallelism,
		base64.RawStdEncoding.EncodeToString(salt),
		base64.RawStdEncoding.EncodeToString(hash)), nil
}

// VerifyPassword checks password against an Argon2id-encoded hash. The
// comparison runs in constant time; any mismatch returns
// ErrInvalidCredentials.
func VerifyPassword(encoded, password string) error {
	parts := strings.Split(encoded, "$")
	// ["", "argon2id", "v=19", "m=...,t=...,p=4", "<salt>", "<hash>"]
	if len(parts) != 6 || parts[1] != "argon2id" {
		return fmt.Errorf("invalid password hash format")
	}

	var memory, time uint32
	var parallelism uint8
	if _, err := fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &memory, &time, &parallelism); err != nil {
		return fmt.Errorf("invalid password hash parameters: %w", err)
	}

	salt, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil {
		return fmt.Errorf("invalid password hash salt: %w", err)
	}
	expected, err := base64.RawStdEncoding.DecodeString(parts[5])
	if err != nil {
		return fmt.Errorf("invalid password hash value: %w", err)
	}

	derived := argon2.IDKey([]byte(password), salt, time, memory, parallelism, uint32(len(expected)))
	if subtle.ConstantTimeCompare(derived, expected) != 1 {
		return ErrInvalidCredentials
	}
	return nil
}

// NewToken returns a cryptographically random 32-byte token as 64 hex chars,
// used as the raw session cookie value.
func NewToken() (string, error) {
	return newRandomHex(32)
}

// NewCSRFToken returns a cryptographically random 32-byte token as 64 hex
// chars, used as the CSRF double-submit value.
func NewCSRFToken() (string, error) {
	return newRandomHex(32)
}

func newRandomHex(size int) (string, error) {
	b := make([]byte, size)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
