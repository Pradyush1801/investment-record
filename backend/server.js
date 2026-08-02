import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

import { User, Invitation, ResetToken } from './models.js';
import { requireAuth, requireAdmin } from './middleware.js';
import { sendInviteEmail, sendPasswordResetEmail } from './email.js';

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());

// ── DB ────────────────────────────────────────────────────────────────────────
await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/di_platform');
console.log('MongoDB connected');

// ── Helpers ───────────────────────────────────────────────────────────────────
function signToken(user) {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role, name: user.name },
    process.env.JWT_SECRET || 'dev_secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function hoursFromNow(h) {
  return new Date(Date.now() + h * 60 * 60 * 1000);
}

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// POST /auth/login
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });
  if (!user.isActive) return res.status(403).json({ error: 'Account disabled' });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

  res.json({ token: signToken(user), user: { id: user._id, name: user.name, email: user.email, role: user.role } });
});

// GET /auth/me — verify token & return user
app.get('/auth/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.user.id).select('-passwordHash');
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

  // Check if user already exists
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) return res.status(409).json({ error: 'A user with this email already exists' });

  // Expire any previous unused invite for this email
  await Invitation.updateMany(
    { email: email.toLowerCase(), usedAt: null },
    { expiresAt: new Date() }
  );

  const token = uuidv4();
  const expiresAt = hoursFromNow(Number(process.env.INVITE_TOKEN_EXPIRES_HOURS) || 72);

  const invite = await Invitation.create({
    email: email.toLowerCase(),
    role,
    token,
    invitedBy: req.user.id,
    expiresAt,
  });

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const inviteLink = `${frontendUrl}/register?token=${token}`;

  // Get inviter name
  const inviter = await User.findById(req.user.id);

  await sendInviteEmail({ to: email, inviteLink, inviterName: inviter?.name || 'An admin' });

  res.status(201).json({
    message: 'Invite sent',
    invite: { id: invite._id, email: invite.email, role: invite.role, expiresAt: invite.expiresAt, inviteLink },
  });
});

// GET /invites — admin lists all invites
app.get('/invites', requireAdmin, async (req, res) => {
  const invites = await Invitation.find()
    .populate('invitedBy', 'name email')
    .sort({ createdAt: -1 });
  res.json({ invites });
});

// DELETE /invites/:id — admin revokes invite
app.delete('/invites/:id', requireAdmin, async (req, res) => {
  await Invitation.findByIdAndDelete(req.params.id);
  res.json({ message: 'Invite revoked' });
});

// GET /invites/validate/:token — check token before showing registration form
app.get('/invites/validate/:token', async (req, res) => {
  const invite = await Invitation.findOne({ token: req.params.token });
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

  const invite = await Invitation.findOne({ token });
  if (!invite) return res.status(404).json({ error: 'Invalid invite link' });
  if (invite.usedAt) return res.status(410).json({ error: 'This invite has already been used' });
  if (invite.expiresAt < new Date()) return res.status(410).json({ error: 'This invite has expired. Please ask for a new one.' });

  // Double-check user doesn't already exist
  const existing = await User.findOne({ email: invite.email });
  if (existing) return res.status(409).json({ error: 'An account with this email already exists' });

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ name, email: invite.email, passwordHash, role: invite.role });

  // Mark invite as used
  invite.usedAt = new Date();
  await invite.save();

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
  const user = await User.findOne({ email: email?.toLowerCase() });
  if (!user || !user.isActive) return;

  // Expire previous tokens
  await ResetToken.updateMany({ userId: user._id, usedAt: null }, { expiresAt: new Date() });

  const token = uuidv4();
  await ResetToken.create({ userId: user._id, token, expiresAt: hoursFromNow(1) });

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetLink = `${frontendUrl}/reset-password?token=${token}`;
  await sendPasswordResetEmail({ to: user.email, resetLink });
});

// POST /auth/reset-password
app.post('/auth/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Token and password required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const record = await ResetToken.findOne({ token });
  if (!record) return res.status(404).json({ error: 'Invalid or expired reset link' });
  if (record.usedAt) return res.status(410).json({ error: 'This reset link has already been used' });
  if (record.expiresAt < new Date()) return res.status(410).json({ error: 'Reset link expired. Please request a new one.' });

  const passwordHash = await bcrypt.hash(password, 12);
  await User.findByIdAndUpdate(record.userId, { passwordHash });

  record.usedAt = new Date();
  await record.save();

  res.json({ message: 'Password updated. You can now log in.' });
});

// ═══════════════════════════════════════════════════════════════════════════════
// USERS (admin)
// ═══════════════════════════════════════════════════════════════════════════════

// GET /users — admin sees all users
app.get('/users', requireAdmin, async (_req, res) => {
  const users = await User.find().select('-passwordHash').sort({ createdAt: -1 });
  res.json({ users });
});

// PATCH /users/:id — admin can change role or deactivate
app.patch('/users/:id', requireAdmin, async (req, res) => {
  const { role, isActive } = req.body;
  const update = {};
  if (role) update.role = role;
  if (typeof isActive === 'boolean') update.isActive = isActive;
  const user = await User.findByIdAndUpdate(req.params.id, update, { new: true }).select('-passwordHash');
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

// ─────────────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
