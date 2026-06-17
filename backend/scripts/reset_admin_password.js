import bcrypt from 'bcryptjs';
import { pool, query } from '../src/config/db.js';

const email = (process.env.ADMIN_RESET_EMAIL || 'admin@missingdiary.test').trim().toLowerCase();
const password = process.env.ADMIN_RESET_PASSWORD || 'password123';

try {
  const hash = await bcrypt.hash(password, 10);
  const result = await query(
    "UPDATE users SET password_hash=$1 WHERE lower(email)=$2 AND role='admin' RETURNING id,email,role",
    [hash, email]
  );

  if (!result.rows.length) {
    console.error(`No admin user found for ${email}.`);
    process.exitCode = 1;
  } else {
    console.log(`Admin password reset for ${result.rows[0].email}.`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
