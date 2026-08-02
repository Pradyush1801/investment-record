/**
 * Run once to create your first admin user:
 *   node seed-admin.js
 *
 * Set ADMIN_NAME / ADMIN_EMAIL / ADMIN_PASSWORD env vars, or edit defaults below.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from './models.js';

const NAME     = process.env.ADMIN_NAME     || 'Admin';
const EMAIL    = process.env.ADMIN_EMAIL    || 'admin@example.com';
const PASSWORD = process.env.ADMIN_PASSWORD || 'ChangeMe123!';

await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/di_platform');

const existing = await User.findOne({ email: EMAIL.toLowerCase() });
if (existing) {
  console.log(`User ${EMAIL} already exists (role: ${existing.role}). Nothing changed.`);
} else {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  await User.create({ name: NAME, email: EMAIL.toLowerCase(), passwordHash, role: 'admin' });
  console.log(`✓ Admin user created: ${EMAIL} / ${PASSWORD}`);
  console.log('  → Change the password immediately after first login!');
}

await mongoose.disconnect();
