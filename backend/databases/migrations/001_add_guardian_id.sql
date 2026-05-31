-- Migration: add guardian_id to missing_persons if missing
ALTER TABLE missing_persons
  ADD COLUMN IF NOT EXISTS guardian_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Optional: create index for guardian lookups
CREATE INDEX IF NOT EXISTS idx_mp_guardian ON missing_persons(guardian_id);
