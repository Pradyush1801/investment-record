import mongoose from 'mongoose';

// ── User ──────────────────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema(
  {
    name:         { type: String, required: true, trim: true },
    email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role:         { type: String, enum: ['admin', 'member'], default: 'member' },
    isActive:     { type: Boolean, default: true },
  },
  { timestamps: true }
);

// ── Invitation ────────────────────────────────────────────────────────────────
const invitationSchema = new mongoose.Schema(
  {
    email:     { type: String, required: true, lowercase: true, trim: true },
    role:      { type: String, enum: ['admin', 'member'], default: 'member' },
    token:     { type: String, required: true, unique: true },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true },
    usedAt:    { type: Date, default: null },   // null = not yet used
  },
  { timestamps: true }
);

// ── Password Reset Token ───────────────────────────────────────────────────────
const resetTokenSchema = new mongoose.Schema(
  {
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    token:     { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt:    { type: Date, default: null },
  },
  { timestamps: true }
);

export const User        = mongoose.model('User', userSchema);
export const Invitation  = mongoose.model('Invitation', invitationSchema);
export const ResetToken  = mongoose.model('ResetToken', resetTokenSchema);
