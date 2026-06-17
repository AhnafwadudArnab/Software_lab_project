-- Migration: allow guardian notes to notify admin and police.

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('request_info', 'found_person_photo', 'new_sighting', 'face_match', 'guardian_note', 'police_update'));
