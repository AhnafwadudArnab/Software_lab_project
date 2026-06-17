-- Keep missing-report_NNN generation ahead of existing rows.
-- This fixes duplicate missing_persons primary keys after seed/import/manual inserts.
CREATE SEQUENCE IF NOT EXISTS missing_report_seq START 1 INCREMENT 1;

SELECT setval(
  'missing_report_seq',
  GREATEST(
    COALESCE((
      SELECT MAX((substring(id FROM '^missing-report_([0-9]+)$'))::int)
      FROM missing_persons
      WHERE id ~ '^missing-report_[0-9]+$'
    ), 0),
    1
  ),
  true
);
