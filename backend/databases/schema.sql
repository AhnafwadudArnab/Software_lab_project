-- ============================================================
-- Missing Diary — Full Schema (clean rebuild)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DROP TABLE IF EXISTS audit_logs, case_timeline, location_trail, police_updates,
                     sighting_face_scans, found_person_photos, notifications,
                     cctv_evidence_uploads, cctv_evidence_requests,
                     cctv_cameras, sightings, person_images, person_videos, missing_persons, users CASCADE;

DROP SEQUENCE IF EXISTS missing_report_seq;

-- ── Sequence for missing-report_NNN IDs ──────────────────────
CREATE SEQUENCE missing_report_seq START 1 INCREMENT 1;

-- ── Users (admin & police only — no public registration) ─────
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(160) UNIQUE NOT NULL,
  phone         VARCHAR(40),
  password_hash TEXT NOT NULL,
  role          VARCHAR(20) NOT NULL CHECK (role IN ('admin','police','guardian','viewer')) DEFAULT 'viewer',
  verified      BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- ── Missing Persons ───────────────────────────────────────────
-- id format: missing-report_001, missing-report_002, ...
CREATE TABLE missing_persons (
  id                    TEXT PRIMARY KEY
                          DEFAULT 'missing-report_' || LPAD(nextval('missing_report_seq')::TEXT, 3, '0'),
  -- Reporter info (anyone can submit — no account needed)
  reporter_name         VARCHAR(120) NOT NULL,
  reporter_phone        VARCHAR(40)  NOT NULL,
  reporter_relation     VARCHAR(60)  NOT NULL,
  -- Person details
  name                  VARCHAR(120) NOT NULL,
  name_bn               VARCHAR(120),
  age                   INT,
  gender                VARCHAR(40),
  skin_color            VARCHAR(40),
  height                VARCHAR(40),
  weight                VARCHAR(40),
  clothing              TEXT,
  identifying_marks     TEXT,
  medical_info          TEXT,
  description           TEXT,
  -- Last seen
  last_seen_location    TEXT NOT NULL,
  last_seen_lat         DOUBLE PRECISION NOT NULL,
  last_seen_lng         DOUBLE PRECISION NOT NULL,
  last_seen_time        TIMESTAMP,
  -- Guardian (authenticated user who submitted the report, if any)
  guardian_id           UUID REFERENCES users(id) ON DELETE SET NULL,
  -- Status & AI
  status                VARCHAR(30) CHECK (status IN ('pending','verified','active','found','closed','rejected')) DEFAULT 'pending',
  ai_verification_score INT,
  ai_flags              TEXT,
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW()
);

-- ── Person Images ─────────────────────────────────────────────
CREATE TABLE person_images (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  missing_person_id TEXT REFERENCES missing_persons(id) ON DELETE CASCADE,
  image_url         TEXT NOT NULL,
  public_id         TEXT,
  created_at        TIMESTAMP DEFAULT NOW()
);

-- ── Person Videos ─────────────────────────────────────────────
CREATE TABLE person_videos (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  missing_person_id TEXT REFERENCES missing_persons(id) ON DELETE CASCADE,
  video_url         TEXT NOT NULL,
  public_id         TEXT,
  created_at        TIMESTAMP DEFAULT NOW()
);

-- ── Sightings (anonymous witnesses submit these) ──────────────
CREATE TABLE sightings (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  missing_person_id TEXT REFERENCES missing_persons(id) ON DELETE CASCADE,
  -- Optional: logged-in user (admin/police) or null for anonymous
  reported_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  -- Witness contact (optional — anonymous allowed)
  reporter_name     VARCHAR(120),
  reporter_phone    VARCHAR(40),
  -- Sighting details
  location_text     TEXT,
  lat               DOUBLE PRECISION NOT NULL,
  lng               DOUBLE PRECISION NOT NULL,
  description       TEXT,
  image_url         TEXT,
  confidence_level  VARCHAR(20) CHECK (confidence_level IN ('sure','maybe','not_sure')) DEFAULT 'maybe',
  status            VARCHAR(20) CHECK (status IN ('pending','verified','rejected','flagged')) DEFAULT 'pending',
  ai_score          INT,
  ai_flags          TEXT,
  sighted_at        TIMESTAMP DEFAULT NOW(),
  created_at        TIMESTAMP DEFAULT NOW()
);

-- ── Face Scan Results for Sighting Photos ───────────────────
CREATE TABLE sighting_face_scans (
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

-- ── Police Updates ────────────────────────────────────────────
CREATE TABLE police_updates (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  missing_person_id TEXT REFERENCES missing_persons(id) ON DELETE CASCADE,
  police_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  update_text       TEXT NOT NULL,
  created_at        TIMESTAMP DEFAULT NOW()
);

-- ── Audit Logs ────────────────────────────────────────────────
CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  target_type TEXT,
  target_id   TEXT,   -- TEXT to support both UUID and missing-report_NNN
  notes       TEXT,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- ── Location Trail (live GPS tracking) ───────────────────────
CREATE TABLE location_trail (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id     TEXT NOT NULL REFERENCES missing_persons(id) ON DELETE CASCADE,
  lat         DOUBLE PRECISION NOT NULL,
  lng         DOUBLE PRECISION NOT NULL,
  recorded_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── Case Timeline ─────────────────────────────────────────────
CREATE TABLE case_timeline (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id       TEXT NOT NULL REFERENCES missing_persons(id) ON DELETE CASCADE,
  entry_time    TIMESTAMP NOT NULL,
  location_text TEXT NOT NULL,
  lat           DOUBLE PRECISION,
  lng           DOUBLE PRECISION,
  notes         TEXT,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── Notifications ─────────────────────────────────────────────
CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  case_id    TEXT REFERENCES missing_persons(id) ON DELETE SET NULL,
  type       VARCHAR(40) NOT NULL CHECK (type IN ('request_info', 'found_person_photo','new_sighting','face_match','guardian_note','police_update')),
  message    TEXT NOT NULL,
  read       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── Found Person Photos ───────────────────────────────────────
CREATE TABLE found_person_photos (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  missing_person_id TEXT NOT NULL REFERENCES missing_persons(id) ON DELETE CASCADE,
  uploaded_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  image_url         TEXT NOT NULL,
  public_id         TEXT,
  created_at        TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── Authorized CCTV Camera Registry ──────────────────────────
CREATE TABLE cctv_cameras (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name               VARCHAR(120) NOT NULL,
  organization       VARCHAR(120),
  owner_name         VARCHAR(120),
  owner_phone        VARCHAR(40),
  owner_email        VARCHAR(160),
  verified_owner     BOOLEAN NOT NULL DEFAULT FALSE,
  region             VARCHAR(80) NOT NULL,
  city               VARCHAR(80) NOT NULL,
  area               VARCHAR(120),
  location_text      TEXT,
  lat                DOUBLE PRECISION,
  lng                DOUBLE PRECISION,
  access_type        VARCHAR(20) NOT NULL CHECK (access_type IN ('authorized','authority','owner_upload')) DEFAULT 'owner_upload',
  status             VARCHAR(20) NOT NULL CHECK (status IN ('unknown','online','offline','maintenance')) DEFAULT 'unknown',
  notes              TEXT,
  last_checked_at    TIMESTAMP,
  last_checked_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at         TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── Permission-based CCTV Evidence Requests ──────────────────
CREATE TABLE cctv_evidence_requests (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  camera_id               UUID NOT NULL REFERENCES cctv_cameras(id) ON DELETE CASCADE,
  missing_person_id        TEXT NOT NULL REFERENCES missing_persons(id) ON DELETE CASCADE,
  requested_by            UUID REFERENCES users(id) ON DELETE SET NULL,
  request_status          VARCHAR(20) NOT NULL CHECK (request_status IN ('pending','submitted','reviewed','rejected','cancelled')) DEFAULT 'pending',
  request_message         TEXT,
  upload_token            TEXT UNIQUE NOT NULL,
  upload_token_expires_at TIMESTAMP NOT NULL,
  submitted_at            TIMESTAMP,
  created_at              TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE cctv_evidence_uploads (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id          UUID NOT NULL REFERENCES cctv_evidence_requests(id) ON DELETE CASCADE,
  uploaded_by_name    VARCHAR(120) NOT NULL,
  uploaded_by_contact VARCHAR(160) NOT NULL,
  evidence_url        TEXT NOT NULL,
  public_id           TEXT,
  file_type           VARCHAR(120),
  notes               TEXT,
  created_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX idx_mp_status          ON missing_persons(status);
CREATE INDEX idx_mp_created         ON missing_persons(created_at DESC);
CREATE INDEX idx_sightings_person   ON sightings(missing_person_id);
CREATE INDEX idx_sightings_created  ON sightings(created_at DESC);
CREATE INDEX idx_sightings_seen     ON sightings(missing_person_id, sighted_at ASC);
CREATE INDEX idx_face_scans_sighting       ON sighting_face_scans(sighting_id);
CREATE INDEX idx_face_scans_matched_person ON sighting_face_scans(matched_person_id);
CREATE INDEX idx_face_scans_status         ON sighting_face_scans(scan_status);
CREATE INDEX idx_audit_target       ON audit_logs(target_id);
CREATE INDEX idx_location_trail_case     ON location_trail(case_id);
CREATE INDEX idx_location_trail_recorded ON location_trail(recorded_at DESC);
CREATE INDEX idx_case_timeline_case ON case_timeline(case_id);
CREATE INDEX idx_notifications_user    ON notifications(user_id);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX idx_found_photos_case     ON found_person_photos(missing_person_id);
CREATE INDEX idx_cctv_region_city      ON cctv_cameras(region, city);
CREATE INDEX idx_cctv_status           ON cctv_cameras(status);
CREATE INDEX idx_cctv_verified_owner   ON cctv_cameras(verified_owner);
CREATE INDEX idx_cctv_requests_case    ON cctv_evidence_requests(missing_person_id);
CREATE INDEX idx_cctv_requests_camera  ON cctv_evidence_requests(camera_id);
CREATE INDEX idx_cctv_uploads_request  ON cctv_evidence_uploads(request_id);

-- ── Seed users (passwords: password123) ──────────────────────
INSERT INTO users (name, email, password_hash, role, verified) VALUES
  ('Admin',          'admin@missingdiary.test',  '$2b$10$QP7iDNJ8ybvx0kAALfL5QeGwYqtW7/9Ot5sUYf0oqB4QQ1QaEeAw2', 'admin',  true),
  ('Police Officer', 'police@missingdiary.test', '$2b$10$QP7iDNJ8ybvx0kAALfL5QeGwYqtW7/9Ot5sUYf0oqB4QQ1QaEeAw2', 'police', true);
-- password123

-- ── Seed missing persons ──────────────────────────────────────
INSERT INTO missing_persons (
  reporter_name, reporter_phone, reporter_relation,
  name, age, gender, skin_color, height, weight,
  clothing, identifying_marks, medical_info, description,
  last_seen_location, last_seen_lat, last_seen_lng, last_seen_time,
  status
) VALUES
(
  'Karim Uddin', '01711000001', 'Son',
  'Hasina Khatun', 65, 'Female', 'Wheatish', '5.1 ft', '55 kg',
  'White saree with blue border',
  'Mole on left cheek',
  'High blood pressure, takes daily medication',
  'Left home for morning walk and did not return.',
  'Narayanganj Sadar', 23.6238, 90.4990,
  NOW() - INTERVAL '10 days',
  'closed'
),
(
  'Rafiq Islam', '01722000002', 'Father',
  'Nusrat Jahan', 19, 'Female', 'Fair', '5.4 ft', '48 kg',
  'Blue salwar kameez, white dupatta',
  'Small scar on right hand',
  NULL,
  'Was returning from college and went missing near bus stop.',
  'Uttara Sector 7, Dhaka', 23.8759, 90.3795,
  NOW() - INTERVAL '5 days',
  'active'
),
(
  'Salma Begum', '01733000003', 'Wife',
  'Jamal Uddin', 42, 'Male', 'Wheatish', '5.7 ft', '72 kg',
  'White panjabi, grey lungi',
  NULL,
  'Has diabetes',
  'Went to the market and did not return.',
  'Karwan Bazar, Dhaka', 23.7516, 90.3930,
  NOW() - INTERVAL '3 days',
  'found'
),
(
  'Nasrin Akter', '01744000004', 'Mother',
  'Rahim Hossain', 14, 'Male', 'Dark', '4.9 ft', '40 kg',
  'School uniform — white shirt, navy trousers',
  'Birthmark on neck',
  NULL,
  'Did not come home after school. Last seen near school gate.',
  'Mirpur 10, Dhaka', 23.8069, 90.3674,
  NOW() - INTERVAL '2 days',
  'active'
);

-- ── Seed person images (South Asian / Bangladeshi-looking portraits) ──
INSERT INTO person_images (missing_person_id, image_url) VALUES
  ('missing-report_001', 'https://xsgames.co/randomusers/assets/avatars/female/46.jpg'),
  ('missing-report_002', 'https://xsgames.co/randomusers/assets/avatars/female/29.jpg'),
  ('missing-report_003', 'https://xsgames.co/randomusers/assets/avatars/male/34.jpg'),
  ('missing-report_004', 'https://xsgames.co/randomusers/assets/avatars/male/17.jpg');

-- ── Demo authorized CCTV registry entries ────────────────────
INSERT INTO cctv_cameras
  (name, organization, owner_name, owner_phone, verified_owner, region, city, area, location_text, lat, lng, access_type, status, notes)
VALUES
  ('Uttara Sector 7 Gate Camera', 'Missing Diary Demo Registry', 'Sector 7 Market Security', '01711001001', true, 'Dhaka Division', 'Dhaka', 'Uttara', 'Uttara Sector 7 main gate', 23.8759, 90.3795, 'owner_upload', 'unknown', 'Demo verified owner. Use evidence request link for footage sharing.'),
  ('Karwan Bazar Market Entrance', 'Missing Diary Demo Registry', 'Market Committee Control Room', '01711001002', true, 'Dhaka Division', 'Dhaka', 'Karwan Bazar', 'Market entrance checkpoint', 23.7516, 90.3930, 'owner_upload', 'unknown', 'Demo verified authority contact for permission-based footage sharing.'),
  ('Narayanganj Sadar Road Camera', 'Missing Diary Demo Registry', 'Sadar Road Camera Owner', '01711001003', true, 'Dhaka Division', 'Narayanganj', 'Sadar', 'Sadar road junction', 23.6238, 90.4990, 'owner_upload', 'unknown', 'Demo entry for region and city evidence requests.');
