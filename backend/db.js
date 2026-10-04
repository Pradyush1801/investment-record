import pg from 'pg';

// Supabase connection string: Dashboard → Connect → "Session pooler" (works over IPv4).
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
});

export async function query(text, params) {
  const { rows } = await pool.query(text, params);
  return rows;
}

export async function queryOne(text, params) {
  const rows = await query(text, params);
  return rows[0] || null;
}

// Column lists that map snake_case columns to the camelCase JSON the frontend expects.
export const USER_PUBLIC_COLS = `
  id as "_id", name, email, role, is_active as "isActive",
  created_at as "createdAt", updated_at as "updatedAt"`;

export const USER_COLS = `${USER_PUBLIC_COLS}, password_hash as "passwordHash"`;
