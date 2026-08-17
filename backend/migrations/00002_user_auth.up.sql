-- Auth migration: additive, non-destructive. Pre-existing users keep
-- role='USER' and password_hash NULL.

ALTER TABLE users
  ADD COLUMN role text NOT NULL DEFAULT 'USER'
    CHECK (role IN ('USER','OWNER','ADMIN')),
  ADD COLUMN password_hash text,
  ADD COLUMN email_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN verification_token text;

CREATE TABLE sessions (
  id         text PRIMARY KEY,
  user_id    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  csrf_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sessions_user    ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);