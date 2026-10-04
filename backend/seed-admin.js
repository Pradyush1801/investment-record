/**
 * Run once to create your first admin user:
 *   node seed-admin.js
 *
 * Set ADMIN_NAME / ADMIN_EMAIL / ADMIN_PASSWORD env vars, or edit defaults below.
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool, queryOne } from './db.js';

const NAME     = process.env.ADMIN_NAME     || 'Admin';
const EMAIL    = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;

const existing = await queryOne(`select role from users where email = $1`, [EMAIL.toLowerCase()]);
if (existing) {
  console.log(`User ${EMAIL} already exists (role: ${existing.role}). Nothing changed.`);
} else {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  await queryOne(
    `insert into users (name, email, password_hash, role) values ($1, $2, $3, 'admin')`,
    [NAME, EMAIL.toLowerCase(), passwordHash]
  );
  console.log(`✓ Admin user created: ${EMAIL} / ${PASSWORD}`);
  console.log('  → Change the password immediately after first login!');
}

await pool.end();
