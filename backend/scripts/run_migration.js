import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { pool } from '../src/config/db.js';

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, '..', 'databases', 'migrations');

async function run() {
  try {
    const migrations = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    for (const migration of migrations) {
      const sqlPath = path.join(migrationsDir, migration);
      const sql = fs.readFileSync(sqlPath, 'utf8');
      console.log('Running migration:', sqlPath);
      await pool.query(sql);
    }

    console.log('Migrations applied successfully.');
    await pool.end();
  } catch (err) {
    console.error('Migration failed:', err);
    await pool.end();
    process.exit(1);
  }
}

run();
