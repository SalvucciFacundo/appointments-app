package service

import (
	"strings"
	"testing"
)

func TestHashPassword_Roundtrip(t *testing.T) {
	hash, err := HashPassword("correct horse battery staple", 65536, 1)
	if err != nil {
		t.Fatalf("HashPassword: %v", err)
	}
	if err := VerifyPassword(hash, "correct horse battery staple"); err != nil {
		t.Errorf("VerifyPassword(correct) = %v, want nil", err)
	}
}

func TestHashPassword_Mismatch(t *testing.T) {
	hash, err := HashPassword("correct horse battery staple", 65536, 1)
	if err != nil {
		t.Fatalf("HashPassword: %v", err)
	}
	if err := VerifyPassword(hash, "wrong password"); err == nil {
		t.Error("VerifyPassword(wrong) = nil, want error")
	}
}

func TestHashPassword_Format(t *testing.T) {
	hash, err := HashPassword("secret123", 65536, 1)
	if err != nil {
		t.Fatalf("HashPassword: %v", err)
	}
	wantPrefix := "$argon2id$v=19$m=65536,t=1,p=4$"
	if !strings.HasPrefix(hash, wantPrefix) {
		t.Errorf("hash prefix = %q, want %q", hash[:min(len(hash), len(wantPrefix))], wantPrefix)
	}
	parts := strings.Split(hash, "$")
	if len(parts) != 6 {
		t.Errorf("hash has %d parts, want 6", len(parts))
	}
	if parts[1] != "argon2id" {
		t.Errorf("hash algorithm = %q, want argon2id", parts[1])
	}
	if parts[4] == "" || parts[5] == "" {
		t.Error("salt or hash segment is empty")
	}
}

func TestVerifyPassword_CustomParameters(t *testing.T) {
	// Verification must honor non-default Argon2 parameters encoded in the
	// stored hash rather than assuming the current defaults.
	hash, err := HashPassword("secret123", 32768, 2)
	if err != nil {
		t.Fatalf("HashPassword: %v", err)
	}
	if err := VerifyPassword(hash, "secret123"); err != nil {
		t.Errorf("VerifyPassword(correct) = %v, want nil", err)
	}
	if err := VerifyPassword(hash, "nope"); err == nil {
		t.Error("VerifyPassword(wrong) = nil, want error")
	}
}

func TestVerifyPassword_RejectsMalformedHash(t *testing.T) {
	if err := VerifyPassword("not-a-hash", "secret123"); err == nil {
		t.Error("VerifyPassword(malformed) = nil, want error")
	}
	if err := VerifyPassword("", "secret123"); err == nil {
		t.Error("VerifyPassword(empty) = nil, want error")
	}
}

func TestNewToken_LengthAndUniqueness(t *testing.T) {
	a, err := NewToken()
	if err != nil {
		t.Fatalf("NewToken: %v", err)
	}
	b, err := NewToken()
	if err != nil {
		t.Fatalf("NewToken: %v", err)
	}
	if len(a) != 64 {
		t.Errorf("token length = %d, want 64", len(a))
	}
	if a == b {
		t.Error("two NewToken calls returned the same value")
	}
}

func TestNewCSRFToken_LengthAndUniqueness(t *testing.T) {
	a, err := NewCSRFToken()
	if err != nil {
		t.Fatalf("NewCSRFToken: %v", err)
	}
	b, err := NewCSRFToken()
	if err != nil {
		t.Fatalf("NewCSRFToken: %v", err)
	}
	if len(a) != 64 {
		t.Errorf("csrf token length = %d, want 64", len(a))
	}
	if a == b {
		t.Error("two NewCSRFToken calls returned the same value")
	}
}
