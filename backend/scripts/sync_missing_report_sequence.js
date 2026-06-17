import { pool, query } from '../src/config/db.js';

try {
  await query('CREATE SEQUENCE IF NOT EXISTS missing_report_seq START 1 INCREMENT 1');
  const result = await query(`
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
    ) AS current_sequence_value
  `);
  const preview = await query("SELECT 'missing-report_' || LPAD((last_value + 1)::TEXT, 3, '0') AS next_case_id FROM missing_report_seq");
  console.log(`missing_report_seq synced at ${result.rows[0].current_sequence_value}.`);
  console.log(`Next case id will be ${preview.rows[0].next_case_id}.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
