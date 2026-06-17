-- Add face matching, actual sighting time, and movement-analysis support to an existing DB.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE sightings
  ADD COLUMN IF NOT EXISTS sighted_at TIMESTAMP DEFAULT NOW();

ALTER TABLE sightings
  DROP CONSTRAINT IF EXISTS sightings_status_check;

ALTER TABLE sightings
  ADD CONSTRAINT sightings_status_check
  CHECK (status IN ('pending','verified','rejected','flagged'));

CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  case_id    TEXT REFERENCES missing_persons(id) ON DELETE SET NULL,
  type       VARCHAR(40) NOT NULL,
  message    TEXT NOT NULL,
  read       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS case_id TEXT REFERENCES missing_persons(id) ON DELETE SET NULL;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS type VARCHAR(40) NOT NULL DEFAULT 'request_info';

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS message TEXT NOT NULL DEFAULT '';

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS read BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();

ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('request_info', 'found_person_photo', 'new_sighting', 'face_match', 'guardian_note', 'police_update'));

CREATE TABLE IF NOT EXISTS sighting_face_scans (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sighting_id         UUID NOT NULL REFERENCES sightings(id) ON DELETE CASCADE,
  matched_person_id   TEXT REFERENCES missing_persons(id) ON DELETE SET NULL,
  face_match_score    NUMERIC(5,2) CHECK (face_match_score >= 0 AND face_match_score <= 100),
  scan_status         VARCHAR(30) NOT NULL CHECK (scan_status IN ('matched','no_match','low_confidence','error')),
  scanned_image_url   TEXT,
  scan_metadata       JSONB,
  scanned_by          UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sightings_seen
  ON sightings(missing_person_id, sighted_at ASC);

CREATE INDEX IF NOT EXISTS idx_notifications_user
  ON notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_created
  ON notifications(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_face_scans_sighting
  ON sighting_face_scans(sighting_id);

CREATE INDEX IF NOT EXISTS idx_face_scans_matched_person
  ON sighting_face_scans(matched_person_id);

CREATE INDEX IF NOT EXISTS idx_face_scans_status
  ON sighting_face_scans(scan_status);
