DROP TABLE IF EXISTS sessions;

ALTER TABLE users
  DROP COLUMN role,
  DROP COLUMN password_hash,
  DROP COLUMN email_verified,
  DROP COLUMN verification_token;