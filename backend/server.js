import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

import { pool, query, queryOne, USER_COLS, USER_PUBLIC_COLS } from './db.js';
import { requireAuth, requireAdmin } from './middleware.js';
import { sendInviteEmail, sendPasswordResetEmail } from './email.js';
import { registerDecisionRoutes } from './decisions.js';

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());

// ── DB ────────────────────────────────────────────────────────────────────────
await pool.query('select 1');
console.log('Postgres connected');

// ── Helpers ───────────────────────────────────────────────────────────────────
function signToken(user) {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role, name: user.name },
    process.env.JWT_SECRET || 'dev_secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (s) => UUID_RE.test(s);

function findUserByEmail(email) {
  return queryOne(`select ${USER_COLS} from users where email = $1`, [email]);
}

function hoursFromNow(h) {
  return new Date(Date.now() + h * 60 * 60 * 1000);
}

// ── Health ────────────────────────────────────────────────────────────────────
// Also touches the DB, so a periodic ping keeps the Supabase project from pausing.
app.get('/health', async (_req, res) => {
  try {
    await pool.query('select 1');
    res.json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'db_unavailable' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// POST /auth/login
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const user = await findUserByEmail(email.toLowerCase());
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });
  if (!user.isActive) return res.status(403).json({ error: 'Account disabled' });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

  res.json({ token: signToken(user), user: { id: user._id, name: user.name, email: user.email, role: user.role } });
});

// GET /auth/me — verify token & return user
app.get('/auth/me', requireAuth, async (req, res) => {
  const user = isUuid(req.user.id)
    ? await queryOne(`select ${USER_PUBLIC_COLS} from users where id = $1`, [req.user.id])
    : null;
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

// ═══════════════════════════════════════════════════════════════════════════════
// INVITE ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// POST /invites — admin sends invite
app.post('/invites', requireAdmin, async (req, res) => {
  const { email, role = 'member' } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  if (!['admin', 'member'].includes(role)) return res.status(400).json({ error: 'Invalid role' });

  // Check if user already exists
  const existing = await findUserByEmail(email.toLowerCase());
  if (existing) return res.status(409).json({ error: 'A user with this email already exists' });

  // Expire any previous unused invite for this email
  await query(
    `update invitations set expires_at = now(), updated_at = now() where email = $1 and used_at is null`,
    [email.toLowerCase()]
  );

  const token = uuidv4();
  const expiresAt = hoursFromNow(Number(process.env.INVITE_TOKEN_EXPIRES_HOURS) || 72);

  const invite = await queryOne(
    `insert into invitations (email, role, token, invited_by, expires_at)
     values ($1, $2, $3, $4, $5)
     returning id as "_id", email, role, expires_at as "expiresAt"`,
    [email.toLowerCase(), role, token, req.user.id, expiresAt]
  );

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const inviteLink = `${frontendUrl}/register?token=${token}`;

  // Get inviter name
  const inviter = await queryOne(`select name from users where id = $1`, [req.user.id]);

  // Email failure shouldn't fail the invite — the admin can still copy the link from the UI.
  try {
    await sendInviteEmail({ to: email, inviteLink, inviterName: inviter?.name || 'An admin' });
  } catch (err) {
    console.error('Invite email failed:', err.message);
  }

  res.status(201).json({
    message: 'Invite sent',
    invite: { id: invite._id, email: invite.email, role: invite.role, expiresAt: invite.expiresAt, inviteLink },
  });
});

// GET /invites — admin lists all invites
app.get('/invites', requireAdmin, async (req, res) => {
  const invites = await query(
    `select i.id as "_id", i.email, i.role, i.token,
            i.expires_at as "expiresAt", i.used_at as "usedAt",
            i.created_at as "createdAt", i.updated_at as "updatedAt",
            case when u.id is null then null
                 else json_build_object('_id', u.id, 'name', u.name, 'email', u.email) end as "invitedBy"
     from invitations i
     left join users u on u.id = i.invited_by
     order by i.created_at desc`
  );
  res.json({ invites });
});

// DELETE /invites/:id — admin revokes invite
app.delete('/invites/:id', requireAdmin, async (req, res) => {
  if (isUuid(req.params.id)) await query(`delete from invitations where id = $1`, [req.params.id]);
  res.json({ message: 'Invite revoked' });
});

// GET /invites/validate/:token — check token before showing registration form
app.get('/invites/validate/:token', async (req, res) => {
  const invite = await queryOne(
    `select email, role, expires_at as "expiresAt", used_at as "usedAt" from invitations where token = $1`,
    [req.params.token]
  );
  if (!invite) return res.status(404).json({ error: 'Invite not found' });
  if (invite.usedAt) return res.status(410).json({ error: 'Invite already used' });
  if (invite.expiresAt < new Date()) return res.status(410).json({ error: 'Invite expired' });
  res.json({ email: invite.email, role: invite.role });
});

// ═══════════════════════════════════════════════════════════════════════════════
// REGISTRATION (via invite token)
// ═══════════════════════════════════════════════════════════════════════════════

// POST /auth/register
app.post('/auth/register', async (req, res) => {
  const { token, name, password } = req.body;
  if (!token || !name || !password) return res.status(400).json({ error: 'Token, name, and password required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const invite = await queryOne(
    `select id, email, role, expires_at as "expiresAt", used_at as "usedAt" from invitations where token = $1`,
    [token]
  );
  if (!invite) return res.status(404).json({ error: 'Invalid invite link' });
  if (invite.usedAt) return res.status(410).json({ error: 'This invite has already been used' });
  if (invite.expiresAt < new Date()) return res.status(410).json({ error: 'This invite has expired. Please ask for a new one.' });

  // Double-check user doesn't already exist
  const existing = await findUserByEmail(invite.email);
  if (existing) return res.status(409).json({ error: 'An account with this email already exists' });

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await queryOne(
    `insert into users (name, email, password_hash, role) values ($1, $2, $3, $4)
     returning ${USER_PUBLIC_COLS}`,
    [name.trim(), invite.email, passwordHash, invite.role]
  );

  // Mark invite as used
  await query(`update invitations set used_at = now(), updated_at = now() where id = $1`, [invite.id]);

  res.status(201).json({
    token: signToken(user),
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PASSWORD RESET
// ═══════════════════════════════════════════════════════════════════════════════

// POST /auth/forgot-password
app.post('/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  // Always return 200 to prevent enumeration
  res.json({ message: 'If an account with that email exists, a reset link has been sent.' });

  // Do the actual work after responding
  if (!email) return;
  const user = await findUserByEmail(email.toLowerCase());
  if (!user || !user.isActive) return;

  // Expire previous tokens
  await query(
    `update reset_tokens set expires_at = now(), updated_at = now() where user_id = $1 and used_at is null`,
    [user._id]
  );

  const token = uuidv4();
  await query(
    `insert into reset_tokens (user_id, token, expires_at) values ($1, $2, $3)`,
    [user._id, token, hoursFromNow(1)]
  );

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetLink = `${frontendUrl}/reset-password?token=${token}`;
  try {
    await sendPasswordResetEmail({ to: user.email, resetLink });
  } catch (err) {
    console.error('Password reset email failed:', err.message);
  }
});

// POST /auth/reset-password
app.post('/auth/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Token and password required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const record = await queryOne(
    `select id, user_id as "userId", expires_at as "expiresAt", used_at as "usedAt" from reset_tokens where token = $1`,
    [token]
  );
  if (!record) return res.status(404).json({ error: 'Invalid or expired reset link' });
  if (record.usedAt) return res.status(410).json({ error: 'This reset link has already been used' });
  if (record.expiresAt < new Date()) return res.status(410).json({ error: 'Reset link expired. Please request a new one.' });

  const passwordHash = await bcrypt.hash(password, 12);
  await query(`update users set password_hash = $1, updated_at = now() where id = $2`, [passwordHash, record.userId]);
  await query(`update reset_tokens set used_at = now(), updated_at = now() where id = $1`, [record.id]);

  res.json({ message: 'Password updated. You can now log in.' });
});

// ═══════════════════════════════════════════════════════════════════════════════
// USERS (admin)
// ═══════════════════════════════════════════════════════════════════════════════

// GET /users — admin sees all users
app.get('/users', requireAdmin, async (_req, res) => {
  const users = await query(`select ${USER_PUBLIC_COLS} from users order by created_at desc`);
  res.json({ users });
});

// PATCH /users/:id — admin can change role or deactivate
app.patch('/users/:id', requireAdmin, async (req, res) => {
  const { role, isActive } = req.body;
  if (role && !['admin', 'member'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  if (!isUuid(req.params.id)) return res.status(404).json({ error: 'User not found' });
  const user = await queryOne(
    `update users
     set role = coalesce($1, role), is_active = coalesce($2, is_active), updated_at = now()
     where id = $3
     returning ${USER_PUBLIC_COLS}`,
    [role || null, typeof isActive === 'boolean' ? isActive : null, req.params.id]
  );
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DECISIONS
// ═══════════════════════════════════════════════════════════════════════════════

registerDecisionRoutes(app, { requireAuth, isUuid });

// ─────────────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
