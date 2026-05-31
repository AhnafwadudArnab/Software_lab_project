import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { pool } from '../src/config/db.js';

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.join(__dirname, '..', 'databases', 'migrations', '001_add_guardian_id.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

async function run() {
  try {
    console.log('Running migration:', sqlPath);
    await pool.query(sql);
    console.log('Migration applied successfully.');
    await pool.end();
  } catch (err) {
    console.error('Migration failed:', err);
    await pool.end();
    process.exit(1);
  }
}

run();
