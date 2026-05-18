-- ============================================================
-- Missing Diary — Sighting History & Face Scan Schema
-- নতুন টেবিল: sighting_face_scans
-- এই ফাইলটা existing schema.sql এর উপরে ADD করতে হবে
-- ============================================================

-- ── Sighting Face Scans ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS sighting_face_scans (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sighting_id         UUID NOT NULL REFERENCES sightings(id) ON DELETE CASCADE,
  matched_person_id   TEXT REFERENCES missing_persons(id) ON DELETE SET NULL,
  face_match_score    NUMERIC(5,2) CHECK (face_match_score >= 0 AND face_match_score <= 100),
  scan_status         VARCHAR(20) NOT NULL
                        CHECK (scan_status IN ('matched', 'no_match', 'low_confidence', 'error'))
                        DEFAULT 'no_match',
  scanned_image_url   TEXT,
  scan_metadata       JSONB,
  scanned_by          UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── Sighting History View ─────────────────────────────────────
CREATE OR REPLACE VIEW sighting_history_view AS
SELECT
  s.id                  AS sighting_id,
  s.missing_person_id,
  s.reporter_name,
  s.reporter_phone,
  s.location_text,
  s.lat,
  s.lng,
  s.description,
  s.image_url,
  s.confidence_level,
  s.status              AS sighting_status,
  s.ai_score,
  s.created_at          AS sighted_at,
  fs.id                 AS scan_id,
  fs.face_match_score,
  fs.scan_status,
  fs.scanned_image_url,
  fs.scan_metadata,
  fs.created_at         AS scanned_at,
  mp.name               AS matched_person_name,
  mp.last_seen_location AS matched_person_last_seen
FROM sightings s
LEFT JOIN sighting_face_scans fs ON fs.sighting_id = s.id
LEFT JOIN missing_persons mp     ON mp.id = fs.matched_person_id;

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_face_scans_sighting
  ON sighting_face_scans(sighting_id);

CREATE INDEX IF NOT EXISTS idx_face_scans_matched_person
  ON sighting_face_scans(matched_person_id);

CREATE INDEX IF NOT EXISTS idx_face_scans_created
  ON sighting_face_scans(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_face_scans_status
  ON sighting_face_scans(scan_status);

-- ============================================================
-- Test Seed Data — Missing Persons + Sightings + Face Scans
-- ============================================================

-- ── Step 1: missing_persons ensure ───────────────────────────
-- schema.sql already run হলে ON CONFLICT DO NOTHING skip করবে
-- না হলে এখানেই insert হবে
INSERT INTO missing_persons (
  id, reporter_name, reporter_phone, reporter_relation,
  name, age, gender, skin_color, height, weight,
  clothing, identifying_marks, medical_info, description,
  last_seen_location, last_seen_lat, last_seen_lng, last_seen_time, status
) VALUES
(
  'missing-report_001',
  'Karim Uddin', '01711000001', 'Son',
  'Hasina Khatun', 65, 'Female', 'Wheatish', '5.1 ft', '55 kg',
  'White saree with blue border', 'Mole on left cheek',
  'High blood pressure, takes daily medication',
  'Left home for morning walk and did not return.',
  'Narayanganj Sadar', 23.6238, 90.4990,
  NOW() - INTERVAL '10 days', 'closed'
),
(
  'missing-report_002',
  'Rafiq Islam', '01722000002', 'Father',
  'Nusrat Jahan', 19, 'Female', 'Fair', '5.4 ft', '48 kg',
  'Blue salwar kameez, white dupatta', 'Small scar on right hand',
  NULL,
  'Was returning from college and went missing near bus stop.',
  'Uttara Sector 7, Dhaka', 23.8759, 90.3795,
  NOW() - INTERVAL '5 days', 'active'
),
(
  'missing-report_003',
  'Salma Begum', '01733000003', 'Wife',
  'Jamal Uddin', 42, 'Male', 'Wheatish', '5.7 ft', '72 kg',
  'White panjabi, grey lungi', NULL,
  'Has diabetes',
  'Went to the market and did not return.',
  'Karwan Bazar, Dhaka', 23.7516, 90.3930,
  NOW() - INTERVAL '3 days', 'found'
),
(
  'missing-report_004',
  'Nasrin Akter', '01744000004', 'Mother',
  'Rahim Hossain', 14, 'Male', 'Dark', '4.9 ft', '40 kg',
  'School uniform — white shirt, navy trousers', 'Birthmark on neck',
  NULL,
  'Did not come home after school. Last seen near school gate.',
  'Mirpur 10, Dhaka', 23.8069, 90.3674,
  NOW() - INTERVAL '2 days', 'active'
)
ON CONFLICT (id) DO NOTHING;

-- sequence sync করো (পরের auto-insert এর জন্য)
SELECT setval('missing_report_seq', 4, true);

-- ── Step 2: Seed Sightings ────────────────────────────────────
INSERT INTO sightings
  (missing_person_id, reporter_name, reporter_phone, location_text,
   lat, lng, description, confidence_level, status, ai_score, created_at)
VALUES
-- Hasina Khatun (001) — 3 sightings
(
  'missing-report_001', 'Kamal Hossain', '01711111111',
  'Narayanganj Bus Stand, Narayanganj', 23.6201, 90.4950,
  'একজন বয়স্ক মহিলাকে দেখলাম সাদা শাড়ি পরা, একা দাঁড়িয়ে ছিলেন। বাম গালে তিল ছিল মনে হলো।',
  'sure', 'verified', 88, NOW() - INTERVAL '9 days 14 hours'
),
(
  'missing-report_001', NULL, NULL,
  'Fatullah, Narayanganj', 23.6089, 90.5012,
  'বাজারের কাছে একজন বৃদ্ধা মহিলা বিভ্রান্ত অবস্থায় ঘুরছিলেন। সাদা-নীল শাড়ি পরা ছিল।',
  'maybe', 'verified', 72, NOW() - INTERVAL '8 days 6 hours'
),
(
  'missing-report_001', 'Rina Begum', '01822222222',
  'Siddhirganj, Narayanganj', 23.6350, 90.5100,
  'মসজিদের সামনে একজন মহিলা বসে ছিলেন, কাঁদছিলেন। বয়স ৬০-৬৫ হবে।',
  'maybe', 'pending', 61, NOW() - INTERVAL '7 days 2 hours'
),
-- Nusrat Jahan (002) — 4 sightings
(
  'missing-report_002', 'Farhan Ahmed', '01933333333',
  'Uttara Sector 6, Dhaka', 23.8712, 90.3801,
  'নীল সালোয়ার কামিজ পরা একটি মেয়েকে দেখলাম, বয়স ১৮-২০ হবে। বাস স্টপে একা দাঁড়িয়ে ছিল।',
  'sure', 'verified', 91, NOW() - INTERVAL '4 days 18 hours'
),
(
  'missing-report_002', NULL, NULL,
  'Uttara Sector 9, Dhaka', 23.8801, 90.3755,
  'একটি মেয়ে রিকশায় উঠছিল, সাদা ওড়না ছিল। ছবির সাথে মিলে যায় মনে হলো।',
  'maybe', 'verified', 68, NOW() - INTERVAL '4 days 5 hours'
),
(
  'missing-report_002', 'Sumaiya Khatun', '01644444444',
  'Abdullahpur, Dhaka', 23.8950, 90.3690,
  'কলেজ ইউনিফর্ম পরা একটি মেয়ে একা হাঁটছিল, কান্নার চিহ্ন ছিল মুখে।',
  'sure', 'verified', 85, NOW() - INTERVAL '3 days 11 hours'
),
(
  'missing-report_002', 'Jahangir Alam', '01755555555',
  'Turag, Dhaka', 23.9012, 90.3620,
  'একটি মেয়েকে একটি সিএনজিতে উঠতে দেখলাম, ফর্সা গায়ের রং, নীল পোশাক।',
  'not_sure', 'pending', 45, NOW() - INTERVAL '2 days 8 hours'
),
-- Jamal Uddin (003) — 3 sightings
(
  'missing-report_003', 'Mosharraf Hossain', '01866666666',
  'Karwan Bazar, Dhaka', 23.7520, 90.3935,
  'সাদা পাঞ্জাবি পরা একজন মধ্যবয়সী পুরুষ বাজারে ঘুরছিলেন, বিভ্রান্ত মনে হচ্ছিল।',
  'sure', 'verified', 93, NOW() - INTERVAL '2 days 20 hours'
),
(
  'missing-report_003', NULL, NULL,
  'Tejgaon, Dhaka', 23.7580, 90.4010,
  'ধূসর লুঙ্গি পরা একজন লোক রাস্তার পাশে বসে ছিলেন, বয়স ৪০-৪৫ হবে।',
  'maybe', 'verified', 74, NOW() - INTERVAL '2 days 10 hours'
),
(
  'missing-report_003', 'Nasrin Sultana', '01977777777',
  'Farmgate, Dhaka', 23.7567, 90.3890,
  'একজন পুরুষ ফুটপাতে ঘুমাচ্ছিলেন, সাদা পাঞ্জাবি পরা। ডায়াবেটিসের রোগী মনে হচ্ছিল।',
  'sure', 'verified', 89, NOW() - INTERVAL '1 day 16 hours'
),
-- Rahim Hossain (004) — 3 sightings
(
  'missing-report_004', 'Taslima Begum', '01588888888',
  'Mirpur 10, Dhaka', 23.8072, 90.3678,
  'স্কুল ইউনিফর্ম পরা একটি ছেলেকে দেখলাম, গলায় জন্মদাগ ছিল। একা ঘুরছিল।',
  'sure', 'verified', 87, NOW() - INTERVAL '1 day 22 hours'
),
(
  'missing-report_004', 'Rafiqul Islam', '01699999999',
  'Mirpur 11, Dhaka', 23.8150, 90.3590,
  'নেভি ট্রাউজার পরা একটি ছেলে মাঠে খেলছিল, বয়স ১৩-১৫ হবে।',
  'maybe', 'pending', 55, NOW() - INTERVAL '18 hours'
),
(
  'missing-report_004', NULL, NULL,
  'Mirpur DOHS, Dhaka', 23.8200, 90.3700,
  'একটি ছেলে রাস্তায় একা হাঁটছিল, কালো গায়ের রং, স্কুল ব্যাগ ছিল।',
  'not_sure', 'pending', 42, NOW() - INTERVAL '6 hours'
);

-- ── Step 3: Seed Face Scan Results ───────────────────────────
-- CTE দিয়ে sighting UUID বের করে একসাথে insert
WITH ranked AS (
  SELECT
    s.id,
    s.missing_person_id,
    s.confidence_level,
    s.status,
    ROW_NUMBER() OVER (
      PARTITION BY s.missing_person_id, s.confidence_level, s.status
      ORDER BY s.created_at ASC
    ) AS rn_asc,
    ROW_NUMBER() OVER (
      PARTITION BY s.missing_person_id, s.confidence_level, s.status
      ORDER BY s.created_at DESC
    ) AS rn_desc
  FROM sightings s
  WHERE s.missing_person_id IN (
    'missing-report_001', 'missing-report_002',
    'missing-report_003', 'missing-report_004'
  )
),
scan_rows AS (
  -- 001 sure verified (oldest) → matched 91.50
  SELECT id, 'missing-report_001'::TEXT AS mp,
         91.50::NUMERIC AS score, 'matched'::VARCHAR(20) AS st,
         'https://xsgames.co/randomusers/assets/avatars/female/46.jpg'::TEXT AS img,
         '{"landmarks":"detected","bounding_box":{"x":120,"y":80,"w":200,"h":240}}'::jsonb AS meta
  FROM ranked WHERE missing_person_id='missing-report_001' AND confidence_level='sure' AND status='verified' AND rn_asc=1

  UNION ALL
  -- 001 maybe verified → low_confidence 63.20
  SELECT id, 'missing-report_001', 63.20, 'low_confidence',
         'https://xsgames.co/randomusers/assets/avatars/female/46.jpg',
         '{"landmarks":"partial","note":"face partially occluded"}'::jsonb
  FROM ranked WHERE missing_person_id='missing-report_001' AND confidence_level='maybe' AND status='verified' AND rn_asc=1

  UNION ALL
  -- 002 sure verified (oldest) → matched 94.80
  SELECT id, 'missing-report_002', 94.80, 'matched',
         'https://xsgames.co/randomusers/assets/avatars/female/29.jpg',
         '{"landmarks":"detected","bounding_box":{"x":95,"y":60,"w":180,"h":220}}'::jsonb
  FROM ranked WHERE missing_person_id='missing-report_002' AND confidence_level='sure' AND status='verified' AND rn_asc=1

  UNION ALL
  -- 002 maybe verified → low_confidence 58.40
  SELECT id, 'missing-report_002', 58.40, 'low_confidence',
         'https://xsgames.co/randomusers/assets/avatars/female/29.jpg',
         '{"landmarks":"partial","note":"side profile only"}'::jsonb
  FROM ranked WHERE missing_person_id='missing-report_002' AND confidence_level='maybe' AND status='verified' AND rn_asc=1

  UNION ALL
  -- 002 sure verified (newest) → matched 88.10
  SELECT id, 'missing-report_002', 88.10, 'matched',
         'https://xsgames.co/randomusers/assets/avatars/female/29.jpg',
         '{"landmarks":"detected","bounding_box":{"x":110,"y":70,"w":190,"h":230}}'::jsonb
  FROM ranked WHERE missing_person_id='missing-report_002' AND confidence_level='sure' AND status='verified' AND rn_desc=1

  UNION ALL
  -- 003 sure verified (oldest) → matched 96.30
  SELECT id, 'missing-report_003', 96.30, 'matched',
         'https://xsgames.co/randomusers/assets/avatars/male/34.jpg',
         '{"landmarks":"detected","bounding_box":{"x":100,"y":75,"w":210,"h":250}}'::jsonb
  FROM ranked WHERE missing_person_id='missing-report_003' AND confidence_level='sure' AND status='verified' AND rn_asc=1

  UNION ALL
  -- 003 maybe verified → low_confidence 67.90
  SELECT id, 'missing-report_003', 67.90, 'low_confidence',
         'https://xsgames.co/randomusers/assets/avatars/male/34.jpg',
         '{"landmarks":"partial","note":"low light conditions"}'::jsonb
  FROM ranked WHERE missing_person_id='missing-report_003' AND confidence_level='maybe' AND status='verified' AND rn_asc=1

  UNION ALL
  -- 003 sure verified (newest) → matched 92.70
  SELECT id, 'missing-report_003', 92.70, 'matched',
         'https://xsgames.co/randomusers/assets/avatars/male/34.jpg',
         '{"landmarks":"detected","bounding_box":{"x":88,"y":65,"w":195,"h":235}}'::jsonb
  FROM ranked WHERE missing_person_id='missing-report_003' AND confidence_level='sure' AND status='verified' AND rn_desc=1

  UNION ALL
  -- 004 sure verified → matched 83.60
  SELECT id, 'missing-report_004', 83.60, 'matched',
         'https://xsgames.co/randomusers/assets/avatars/male/17.jpg',
         '{"landmarks":"detected","bounding_box":{"x":105,"y":72,"w":185,"h":225}}'::jsonb
  FROM ranked WHERE missing_person_id='missing-report_004' AND confidence_level='sure' AND status='verified' AND rn_asc=1

  UNION ALL
  -- 004 maybe pending → no_match 31.20
  SELECT id, NULL::TEXT, 31.20, 'no_match',
         NULL::TEXT,
         '{"note":"different person, age mismatch"}'::jsonb
  FROM ranked WHERE missing_person_id='missing-report_004' AND confidence_level='maybe' AND status='pending' AND rn_asc=1
)
INSERT INTO sighting_face_scans
  (sighting_id, matched_person_id, face_match_score, scan_status, scanned_image_url, scan_metadata)
SELECT id, mp, score, st, img, meta
FROM scan_rows;

-- ============================================================
-- Migration: users role constraint — guardian role support
-- schema.sql এ role CHECK শুধু 'admin','police' ছিল
-- এখন 'guardian' ও accept করবে (backward compatible)
-- ============================================================
DO $$
BEGIN
  ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
  ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('admin', 'police', 'guardian'));
EXCEPTION WHEN others THEN
  NULL;
END $$;
