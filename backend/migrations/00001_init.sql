-- +goose Up
CREATE TYPE appointment_status AS ENUM ('PENDING','CONFIRMED','CANCELLED','COMPLETED');

CREATE TABLE users (
    id    text PRIMARY KEY,
    name  text,
    email text UNIQUE,
    image text
);

CREATE TABLE stores (
    id                   text PRIMARY KEY,
    name                 text NOT NULL,
    slug                 text NOT NULL UNIQUE,
    description          text,
    address              text NOT NULL,
    phone                text,
    latitude             double precision,
    longitude            double precision,
    specialty            text NOT NULL,
    owner_id             text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    timezone             text NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
    slot_duration        integer NOT NULL DEFAULT 60,
    max_parallel_bookings integer NOT NULL DEFAULT 1,
    max_slots_per_day    integer NOT NULL DEFAULT 0,
    cancelation_limit    integer NOT NULL DEFAULT 2,
    suspended            boolean NOT NULL DEFAULT false,
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_stores_owner ON stores(owner_id);
CREATE INDEX idx_stores_specialty ON stores(specialty);

CREATE TABLE business_hours (
    id         text PRIMARY KEY,
    store_id   text NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    day_of_week integer NOT NULL,
    open_time  text NOT NULL,   -- HH:MM
    close_time text NOT NULL    -- HH:MM
);
CREATE INDEX idx_business_hours_store ON business_hours(store_id);

CREATE TABLE blocked_dates (
    id       text PRIMARY KEY,
    store_id text NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    date     date NOT NULL,
    reason   text
);
CREATE INDEX idx_blocked_dates_store ON blocked_dates(store_id);

CREATE TABLE appointments (
    id              text PRIMARY KEY,
    store_id        text NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    user_id         text REFERENCES users(id) ON DELETE SET NULL,
    client_name     text NOT NULL,
    client_phone    text NOT NULL,
    client_email    text NOT NULL,
    date_time       timestamptz NOT NULL,
    service         text,
    status          appointment_status NOT NULL DEFAULT 'CONFIRMED',
    notes           text,
    management_token text UNIQUE,
    google_event_id text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_appointments_store_datetime ON appointments(store_id, date_time);
CREATE INDEX idx_appointments_user ON appointments(user_id);

-- +goose Down
DROP TABLE IF EXISTS appointments;
DROP TABLE IF EXISTS blocked_dates;
DROP TABLE IF EXISTS business_hours;
DROP TABLE IF EXISTS stores;
DROP TABLE IF EXISTS users;
DROP TYPE IF EXISTS appointment_status;