-- Migration: create table for police found-person photo uploads.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS found_person_photos (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  missing_person_id TEXT NOT NULL REFERENCES missing_persons(id) ON DELETE CASCADE,
  uploaded_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  image_url         TEXT NOT NULL,
  public_id         TEXT,
  created_at        TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_found_photos_case
  ON found_person_photos(missing_person_id);
