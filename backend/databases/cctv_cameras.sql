CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS cctv_cameras (
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

ALTER TABLE cctv_cameras ADD COLUMN IF NOT EXISTS owner_name VARCHAR(120);
ALTER TABLE cctv_cameras ADD COLUMN IF NOT EXISTS owner_phone VARCHAR(40);
ALTER TABLE cctv_cameras ADD COLUMN IF NOT EXISTS owner_email VARCHAR(160);
ALTER TABLE cctv_cameras ADD COLUMN IF NOT EXISTS verified_owner BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE cctv_cameras DROP CONSTRAINT IF EXISTS cctv_cameras_access_type_check;
UPDATE cctv_cameras SET access_type = 'owner_upload' WHERE access_type NOT IN ('authorized','authority','owner_upload');
ALTER TABLE cctv_cameras
  ADD CONSTRAINT cctv_cameras_access_type_check
  CHECK (access_type IN ('authorized','authority','owner_upload'));

CREATE TABLE IF NOT EXISTS cctv_evidence_requests (
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

CREATE TABLE IF NOT EXISTS cctv_evidence_uploads (
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

CREATE INDEX IF NOT EXISTS idx_cctv_region_city ON cctv_cameras(region, city);
CREATE INDEX IF NOT EXISTS idx_cctv_status ON cctv_cameras(status);
CREATE INDEX IF NOT EXISTS idx_cctv_verified_owner ON cctv_cameras(verified_owner);
CREATE INDEX IF NOT EXISTS idx_cctv_requests_case ON cctv_evidence_requests(missing_person_id);
CREATE INDEX IF NOT EXISTS idx_cctv_requests_camera ON cctv_evidence_requests(camera_id);
CREATE INDEX IF NOT EXISTS idx_cctv_uploads_request ON cctv_evidence_uploads(request_id);

INSERT INTO cctv_cameras
  (name, organization, owner_name, owner_phone, verified_owner, region, city, area, location_text, lat, lng, access_type, status, notes)
VALUES
  ('Uttara Sector 7 Gate Camera', 'Missing Diary Demo Registry', 'Sector 7 Market Security', '01711001001', true, 'Dhaka Division', 'Dhaka', 'Uttara', 'Uttara Sector 7 main gate', 23.8759, 90.3795, 'owner_upload', 'unknown', 'Demo verified owner. Use evidence request link for footage sharing.'),
  ('Karwan Bazar Market Entrance', 'Missing Diary Demo Registry', 'Market Committee Control Room', '01711001002', true, 'Dhaka Division', 'Dhaka', 'Karwan Bazar', 'Market entrance checkpoint', 23.7516, 90.3930, 'owner_upload', 'unknown', 'Demo verified authority contact for permission-based footage sharing.'),
  ('Narayanganj Sadar Road Camera', 'Missing Diary Demo Registry', 'Sadar Road Camera Owner', '01711001003', true, 'Dhaka Division', 'Narayanganj', 'Sadar', 'Sadar road junction', 23.6238, 90.4990, 'owner_upload', 'unknown', 'Demo entry for region and city evidence requests.')
ON CONFLICT DO NOTHING;
