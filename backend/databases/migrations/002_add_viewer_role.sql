-- Migration: add viewer role and keep guardian only for users who uploaded cases.

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'police', 'guardian', 'viewer'));

ALTER TABLE users
  ALTER COLUMN role SET DEFAULT 'viewer';

UPDATE users u
SET role = 'viewer'
WHERE u.role = 'guardian'
  AND NOT EXISTS (
    SELECT 1
    FROM missing_persons mp
    WHERE mp.guardian_id = u.id
  );
